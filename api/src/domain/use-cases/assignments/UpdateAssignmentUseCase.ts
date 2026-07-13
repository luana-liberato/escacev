import { Assignment } from '../../entities/Assignment';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../services/AssignmentEligibility';
import { ConflictDetail, ConflictDetectionService } from '../../services/ConflictDetectionService';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface UpdateAssignmentDTO {
  institutionId: string;
  actor: Actor;
  id: string;
  memberId?: string;
  positionId?: string;
  confirmConflict?: boolean;
}

/** A edição foi aplicada: a alocação já está com os novos valores persistidos. */
export interface UpdateAssignmentApplied {
  status: 'applied';
  assignment: Assignment;
}

/**
 * A edição NÃO foi aplicada: gera conflito de horário (RN01) e o item não veio
 * confirmado. O admin decide: reenviar com `confirmConflict: true` (aplica com
 * `conflict = true`) ou desistir. Não é erro — é "aguardando decisão".
 */
export interface UpdateAssignmentNeedsConfirmation {
  status: 'needs_confirmation';
  conflicts: ConflictDetail[];
}

export type UpdateAssignmentResult = UpdateAssignmentApplied | UpdateAssignmentNeedsConfirmation;

/**
 * Edita uma alocação existente — troca a pessoa, a função, ou ambas (edição
 * UNITÁRIA, um id por vez; não é lote como o AddAssignmentsUseCase). Integra o
 * motor de conflito (RN01/RN03) com a MESMA confirmação ciente do Add: não
 * bloqueia conflito, avisa e pede confirmação — só aplica uma edição
 * conflituosa se `confirmConflict = true`, e nesse caso `conflict` vira `true`.
 *
 * Revalida as MESMAS regras do Add para os valores novos, via a mesma
 * AssignmentEligibility (não duplica a checagem de pertencimento ao ministério):
 *  - se o memberId muda, o novo membro precisa pertencer ao ministério da escala;
 *  - se o positionId muda, a nova função precisa pertencer ao mesmo ministério.
 *
 * ORDEM DE AVALIAÇÃO:
 *  1. Alocação existe (404) + tenant (404) + permissão (403) + "ao menos um
 *     campo" (400) + pertencimento do novo membro/função (400/404) — falha
 *     aqui NEM CHEGA a checar conflito (irrecuperável, como no Add).
 *  2. Duplicata com OUTRA alocação (409) — só quando o par realmente muda; se
 *     nada mudou, o par é o da própria linha, não há o que colidir.
 *  3. ConflictDetectionService.check() com o horário do evento da escala e
 *     `excludeAssignmentId = assignment.id` — SEMPRE, mesmo quando o par não
 *     muda: é isso que impede a própria alocação de conflitar consigo mesma
 *     (sem isso, editar sem trocar nada acusaria auto-conflito).
 *  4. Sem conflito → aplica com `conflict = false` (recalculado, nunca herdado
 *     do estado antigo — resolve um conflito anterior automaticamente).
 *  5. Com conflito e SEM confirmConflict → `needs_confirmation`, NÃO aplica.
 *  6. Com conflito e COM confirmConflict = true → aplica com `conflict = true`.
 *
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class UpdateAssignmentUseCase {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eventRepo: EventRepository,
    private readonly eligibility: AssignmentEligibility,
    private readonly accessPolicy: MinistryAccessPolicy,
    private readonly conflictDetection: ConflictDetectionService,
  ) {}

  async execute(dto: UpdateAssignmentDTO): Promise<UpdateAssignmentResult> {
    const assignment = await this.assignmentRepo.findById(dto.id);
    if (!assignment) {
      throw new AppError('Alocação não encontrada', 404);
    }

    const schedule = await this.scheduleRepo.findById(assignment.scheduleId);
    if (!schedule) {
      throw new AppError('Alocação não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Alocação não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    if (dto.memberId === undefined && dto.positionId === undefined) {
      throw new AppError('Informe ao menos um campo para atualizar (memberId ou positionId)', 400);
    }

    if (dto.memberId !== undefined) {
      const failure = await this.eligibility.checkMember(dto.memberId, ministry.id);
      if (failure) throw new AppError(failure.reason, failure.statusCode);
    }
    if (dto.positionId !== undefined) {
      const failure = await this.eligibility.checkPosition(dto.positionId, ministry.id);
      if (failure) throw new AppError(failure.reason, failure.statusCode);
    }

    const candidate = assignment.update({ memberId: dto.memberId, positionId: dto.positionId });

    // Só checa duplicata se o par (membro, função) realmente mudou — se nada
    // mudou, o par pertence à própria linha sendo editada (não é colisão).
    const pairChanged =
      candidate.memberId !== assignment.memberId || candidate.positionId !== assignment.positionId;
    if (pairChanged) {
      const exists = await this.assignmentRepo.existsByScheduleMemberPosition(
        schedule.id,
        candidate.memberId,
        candidate.positionId,
      );
      if (exists) {
        throw new AppError('Esta pessoa já está alocada nesta função nesta escala', 409);
      }
    }

    const event = await this.eventRepo.findById(schedule.eventId);
    if (!event) {
      throw new AppError('Alocação não encontrada', 404);
    }

    const conflictResult = await this.conflictDetection.check({
      memberId: candidate.memberId,
      positionId: candidate.positionId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      excludeAssignmentId: assignment.id,
    });

    if (conflictResult.hasConflict && !dto.confirmConflict) {
      return { status: 'needs_confirmation', conflicts: conflictResult.conflicts };
    }

    const finalAssignment = candidate.update({ conflict: conflictResult.hasConflict });
    const saved = await this.assignmentRepo.update(finalAssignment);
    return { status: 'applied', assignment: saved };
  }
}
