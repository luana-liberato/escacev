import { Assignment } from '../../entities/Assignment';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../services/AssignmentEligibility';
import { AppError } from '../../../shared/errors/AppError';

/** Um item do lote: a pessoa e a função que ela vai exercer na escala. */
export interface AssignmentItem {
  memberId: string;
  positionId: string;
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

/** Resultado do lote: os criados com sucesso e os que falharam (com motivo). */
export interface AddAssignmentsResult {
  created: Assignment[];
  failed: FailedAssignment[];
}

/**
 * Adiciona um lote de alocações (pessoa + função) a uma escala — alocação
 * DIRETA, sem vaga abstrata. Não implementa o motor de conflito (RN01/RN03):
 * toda alocação criada aqui nasce com `conflict = false`.
 *
 * PRÉ-CONDIÇÕES do lote inteiro (falham a operação toda, nenhum item processado):
 *  - a escala existe e pertence à instituição do usuário (tenant via ministério);
 *  - o ator administra o ministério da escala (Permissão Escopada — reusa a
 *    MinistryAccessPolicy.ensureCanManage).
 *
 * VALIDAÇÃO POR ITEM (parcial — um item inválido não derruba os demais):
 *  - o membro existe e pertence ao ministério da escala; a função existe e
 *    pertence ao mesmo ministério — checagem compartilhada com o
 *    UpdateAssignmentUseCase via AssignmentEligibility (não duplica a regra);
 *  - não é duplicata (nem já existente na escala, nem repetida dentro do próprio lote).
 *
 * PERSISTÊNCIA: processamento SEQUENCIAL, um save() por item — sem envolver o
 * lote numa transação com rollback geral (um item ruim não pode apagar os itens
 * bons já salvos). O save() de cada item tem seu próprio try/catch: mesmo já
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
    private readonly eligibility: AssignmentEligibility,
    private readonly accessPolicy: MinistryAccessPolicy,
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

    const created: Assignment[] = [];
    const failed: FailedAssignment[] = [];
    // Rastreia os pares já aceitos NESTE lote — pega duplicata dentro do próprio
    // array de entrada, além da duplicata já existente no banco (checada abaixo).
    const seenInBatch = new Set<string>();

    for (const item of dto.items) {
      const reason = await this.validateItem(item, schedule.id, ministry.id, seenInBatch);
      if (reason) {
        failed.push({ item, reason });
        continue;
      }

      try {
        const assignment = Assignment.create({
          scheduleId: schedule.id,
          memberId: item.memberId,
          positionId: item.positionId,
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

    return { created, failed };
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
