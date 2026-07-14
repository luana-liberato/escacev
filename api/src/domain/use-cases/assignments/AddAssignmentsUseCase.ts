import { Assignment } from '../../entities/Assignment';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../services/AssignmentEligibility';
import { ConflictDetail, ConflictDetectionService } from '../../services/ConflictDetectionService';
import { Unavailability } from '../../entities/Unavailability';
import { UnavailabilityRepository } from '../../repositories/UnavailabilityRepository';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Um item do lote: a pessoa e a função que ela vai exercer na escala.
 * `confirm`: quando o item já foi reportado em `needsConfirmation` numa tentativa
 * anterior (por conflito de horário RN01 e/ou indisponibilidade RN05), o admin
 * reenvia o MESMO item com esta flag em `true` para escalar cientemente mesmo
 * assim. É uma confirmação ÚNICA que reconhece todos os alertas do item — a
 * alocação criada só registra `conflict = true` quando havia conflito (RN03); a
 * indisponibilidade é apenas alerta, não fica marcada na alocação.
 */
export interface AssignmentItem {
  memberId: string;
  positionId: string;
  confirm?: boolean;
}

/** institutionId vem do JWT (req.user), nunca do body. */
export interface AddAssignmentsDTO {
  institutionId: string;
  actor: Actor;
  scheduleId: string;
  items: AssignmentItem[];
}

/** Um item do lote que não pôde ser alocado, com o motivo em português. */
export interface FailedAssignment {
  item: AssignmentItem;
  reason: string;
}

/**
 * Um item que passou nas validações mas dispara ALERTA — conflito de horário
 * (RN01, `conflicts`) e/ou indisponibilidade do membro no período (RN05,
 * `unavailabilities`) — e não veio confirmado, então NÃO foi criado. O admin
 * decide: reenviar este MESMO item com `confirm: true` (cria mesmo assim) ou
 * desistir. Diferente de `failed`: aqui reenviar PODE funcionar. Pelo menos uma
 * das listas está não-vazia.
 */
export interface NeedsConfirmationAssignment {
  item: AssignmentItem;
  conflicts: ConflictDetail[];
  unavailabilities: Unavailability[];
}

/** Resultado do lote: criados, falhados (irrecuperável) e pendentes de confirmação (reenviáveis). */
export interface AddAssignmentsResult {
  created: Assignment[];
  failed: FailedAssignment[];
  needsConfirmation: NeedsConfirmationAssignment[];
}

/**
 * Adiciona um lote de alocações (pessoa + função) a uma escala — alocação
 * DIRETA, sem vaga abstrata. Integra DOIS alertas que NÃO bloqueiam, avisam e
 * pedem confirmação ciente: o motor de conflito (RN01/RN03) e a indisponibilidade
 * do membro no período (RN05). Só cria um item alertado se ele vier com
 * `confirm = true` — confirmação única que cobre ambos. A alocação registra
 * `conflict = true` apenas quando havia conflito; a indisponibilidade é só alerta.
 *
 * PRÉ-CONDIÇÕES do lote inteiro (falham a operação toda, nenhum item processado):
 *  - a escala existe e pertence à instituição do usuário (tenant via ministério);
 *  - o ator administra o ministério da escala (Permissão Escopada — reusa a
 *    MinistryAccessPolicy.ensureCanManage).
 *
 * CLASSIFICAÇÃO POR ITEM (parcial — um item nunca derruba os demais):
 *  1. Validação de pertencimento (membro/função do ministério) + duplicata
 *     (AssignmentEligibility) — falha aqui vai para `failed` e NEM CHEGA a
 *     checar os alertas (irrecuperável: reenviar não muda a validação).
 *  2. Passou: roda o ConflictDetectionService (conflito, RN01) E busca as
 *     indisponibilidades que sobrepõem o horário do evento (RN05).
 *  3. Sem conflito e sem indisponibilidade → `created` (conflict = false).
 *  4. Com algum alerta e SEM confirm → `needsConfirmation` (NÃO cria; o admin
 *     decide reenviar o mesmo item com confirm = true).
 *  5. Com algum alerta e COM confirm = true → `created` (conflict = true só se
 *     havia conflito de horário).
 *
 * PERSISTÊNCIA: processamento SEQUENCIAL, um save() por item — sem envolver o
 * lote numa transação com rollback geral (um item ruim/pendente não apaga os
 * itens já salvos). O save() de cada item tem seu próprio try/catch: mesmo já
 * validado em memória, uma corrida entre requisições concorrentes pode fazer o
 * banco rejeitar por violação do @@unique — esse catch converte a exceção em
 * mais uma entrada de `failed`, sem interromper o restante do lote nem desfazer
 * os itens já persistidos antes dele. Dependências injetadas via construtor (4.2).
 */
export class AddAssignmentsUseCase {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eventRepo: EventRepository,
    private readonly eligibility: AssignmentEligibility,
    private readonly accessPolicy: MinistryAccessPolicy,
    private readonly conflictDetection: ConflictDetectionService,
    private readonly unavailabilityRepo: UnavailabilityRepository,
  ) {}

  async execute(dto: AddAssignmentsDTO): Promise<AddAssignmentsResult> {
    const schedule = await this.scheduleRepo.findById(dto.scheduleId);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    // Todos os itens do lote são da MESMA escala → mesmo evento; busca uma vez.
    const event = await this.eventRepo.findById(schedule.eventId);
    if (!event) {
      throw new AppError('Escala não encontrada', 404);
    }

    const created: Assignment[] = [];
    const failed: FailedAssignment[] = [];
    const needsConfirmation: NeedsConfirmationAssignment[] = [];
    // Rastreia os pares já ACEITOS (criados) NESTE lote — pega duplicata dentro
    // do próprio array de entrada, além da duplicata já existente no banco
    // (checada abaixo). Itens em needsConfirmation não entram aqui: não foram
    // criados, então não bloqueiam um item posterior igual no mesmo lote.
    const seenInBatch = new Set<string>();

    for (const item of dto.items) {
      const reason = await this.validateItem(item, schedule.id, ministry.id, seenInBatch);
      if (reason) {
        failed.push({ item, reason });
        continue;
      }

      const conflictResult = await this.conflictDetection.check({
        memberId: item.memberId,
        positionId: item.positionId,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      });
      const unavailabilities = await this.unavailabilityRepo.findByMemberOverlapping(
        item.memberId,
        event.startsAt,
        event.endsAt,
      );

      const hasAlert = conflictResult.hasConflict || unavailabilities.length > 0;
      if (hasAlert && !item.confirm) {
        needsConfirmation.push({ item, conflicts: conflictResult.conflicts, unavailabilities });
        continue;
      }

      try {
        const assignment = Assignment.create({
          scheduleId: schedule.id,
          memberId: item.memberId,
          positionId: item.positionId,
          // RN03: registra o conflito confirmado. A indisponibilidade (RN05) é só
          // alerta — quando confirmada, a alocação nasce sem marca própria.
          conflict: conflictResult.hasConflict,
        });
        created.push(await this.assignmentRepo.save(assignment));
        seenInBatch.add(AddAssignmentsUseCase.batchKey(item));
      } catch {
        // Backstop de corrida: outra requisição criou o mesmo par entre a
        // validação acima e este save(). Reporta como duplicata, sem afetar
        // os itens já salvos antes deste no mesmo lote.
        failed.push({ item, reason: 'Esta pessoa já está alocada nesta função nesta escala' });
      }
    }

    return { created, failed, needsConfirmation };
  }

  /** Retorna o motivo da falha (string) ou null quando o item é válido. */
  private async validateItem(
    item: AssignmentItem,
    scheduleId: string,
    ministryId: string,
    seenInBatch: Set<string>,
  ): Promise<string | null> {
    if (seenInBatch.has(AddAssignmentsUseCase.batchKey(item))) {
      return 'Esta pessoa já está alocada nesta função nesta escala';
    }

    const memberFailure = await this.eligibility.checkMember(item.memberId, ministryId);
    if (memberFailure) return memberFailure.reason;

    const positionFailure = await this.eligibility.checkPosition(item.positionId, ministryId);
    if (positionFailure) return positionFailure.reason;

    const exists = await this.assignmentRepo.existsByScheduleMemberPosition(
      scheduleId,
      item.memberId,
      item.positionId,
    );
    if (exists) return 'Esta pessoa já está alocada nesta função nesta escala';

    return null;
  }

  private static batchKey(item: AssignmentItem): string {
    return `${item.memberId}:${item.positionId}`;
  }
}
