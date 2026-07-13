import { Assignment } from '../../entities/Assignment';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../services/AssignmentEligibility';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. memberId/positionId são opcionais. */
export interface UpdateAssignmentDTO {
  institutionId: string;
  actor: Actor;
  id: string;
  memberId?: string;
  positionId?: string;
}

/**
 * Edita uma alocação existente — troca a pessoa, a função, ou ambas (edição
 * UNITÁRIA, um id por vez; não é lote como o AddAssignmentsUseCase). `conflict`
 * NÃO é mexido aqui — é responsabilidade do motor de conflito (fora deste bloco).
 *
 * Revalida as MESMAS regras do Add para os valores novos, via a mesma
 * AssignmentEligibility (não duplica a checagem de pertencimento ao ministério):
 *  - se o memberId muda, o novo membro precisa pertencer ao ministério da escala;
 *  - se o positionId muda, a nova função precisa pertencer ao mesmo ministério.
 *
 * O resultado da edição não pode colidir com o @@unique([escalaId, membroId,
 * funcaoId]): só checa duplicata quando o par (membro, função) realmente muda —
 * se nada mudou, o par é o da própria linha, não há o que colidir. Colisão com
 * OUTRA alocação já existente na escala → 409 (mesma convenção de duplicata
 * usada em todo o projeto). Dependências injetadas via construtor (Seção 4.2).
 */
export class UpdateAssignmentUseCase {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eligibility: AssignmentEligibility,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: UpdateAssignmentDTO): Promise<Assignment> {
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

    const updated = assignment.update({ memberId: dto.memberId, positionId: dto.positionId });

    // Só checa duplicata se o par (membro, função) realmente mudou — se nada
    // mudou, o par pertence à própria linha sendo editada (não é colisão).
    const pairChanged =
      updated.memberId !== assignment.memberId || updated.positionId !== assignment.positionId;
    if (pairChanged) {
      const exists = await this.assignmentRepo.existsByScheduleMemberPosition(
        schedule.id,
        updated.memberId,
        updated.positionId,
      );
      if (exists) {
        throw new AppError('Esta pessoa já está alocada nesta função nesta escala', 409);
      }
    }

    return this.assignmentRepo.update(updated);
  }
}
