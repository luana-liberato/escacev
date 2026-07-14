import { Assignment } from '../../entities/Assignment';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../services/AssignmentEligibility';
import { ConflictDetail, ConflictDetectionService } from '../../services/ConflictDetectionService';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Um item do lote: a pessoa e a função que ela vai exercer na escala.
 * `confirmConflict`: quando o item já foi reportado em `needsConfirmation`
 * numa tentativa anterior, o admin reenvia o MESMO item com esta flag em
 * `true` para confirmar cientemente a alocação conflituosa (RN03).
 */
export interface AssignmentItem {
  memberId: string;
  positionId: string;
  confirmConflict?: boolean;
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
 * Um item que passou nas validações mas tem conflito de horário (RN01) e não
 * veio confirmado — NÃO foi criado. O admin decide: reenviar este MESMO item
 * com `confirmConflict: true` (cria com `conflict = true`) ou desistir dele.
 * Diferente de `failed`: aqui reenviar PODE funcionar.
 */
export interface NeedsConfirmationAssignment {
  item: AssignmentItem;
  conflicts: ConflictDetail[];
}

/** Resultado do lote: criados, falhados (irrecuperável) e pendentes de confirmação (reenviáveis). */
export interface AddAssignmentsResult {
  created: Assignment[];
  failed: FailedAssignment[];
  needsConfirmation: NeedsConfirmationAssignment[];
}

/**
 * Adiciona um lote de alocações (pessoa + função) a uma escala — alocação
 * DIRETA, sem vaga abstrata. Integra o motor de conflito (RN01/RN03): NÃO
 * bloqueia conflito, avisa e pede confirmação ciente — só cria uma alocação
 * conflituosa se o item vier com `confirmConflict = true`, e nesse caso ela
 * nasce com `conflict = true`.
 *
 * PRÉ-CONDIÇÕES do lote inteiro (falham a operação toda, nenhum item processado):
 *  - a escala existe e pertence à instituição do usuário (tenant via ministério);
 *  - o ator administra o ministério da escala (Permissão Escopada — reusa a
 *    MinistryAccessPolicy.ensureCanManage).
 *
 * CLASSIFICAÇÃO POR ITEM (parcial — um item nunca derruba os demais):
 *  1. Validação de pertencimento (membro/função do ministério) + duplicata
 *     (AssignmentEligibility) — falha aqui vai para `failed` e NEM CHEGA a
 *     checar conflito (irrecuperável: reenviar não muda a validação).
 *  2. Passou: roda o ConflictDetectionService (injetado, não reimplementado)
 *     com o horário do evento da escala.
 *  3. Sem conflito → `created` (conflict = false).
 *  4. Com conflito e SEM confirmConflict → `needsConfirmation` (NÃO cria; o
 *     admin decide reenviar o mesmo item com confirmConflict = true).
 *  5. Com conflito e COM confirmConflict = true → `created` (conflict = true).
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

      if (conflictResult.hasConflict && !item.confirmConflict) {
        needsConfirmation.push({ item, conflicts: conflictResult.conflicts });
        continue;
      }

      try {
        const assignment = Assignment.create({
          scheduleId: schedule.id,
          memberId: item.memberId,
          positionId: item.positionId,
          conflict: conflictResult.hasConflict, // true só quando confirmado (o outro caso já foi para needsConfirmation)
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
