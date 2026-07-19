import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AssignmentDetail, AssignmentRepository } from '../../repositories/AssignmentRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { Actor } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetScheduleDTO {
  institutionId: string;
  id: string;
  /** Ator autenticado — usado só para escopar a visão do MEMBRO. */
  actor?: Actor;
}

/** Escala + suas alocações (cada uma já com membro e função resolvidos). */
export interface ScheduleWithAssignments {
  schedule: Schedule;
  assignments: AssignmentDetail[];
}

/**
 * Busca uma escala por id, já com suas alocações (pessoa + função de cada uma).
 * Valida o tenant pela instituição do ministério da escala — a Escala não tem
 * instituicaoId próprio. Responde 404 quando não existe ou é de outra
 * instituição, sem vazar recursos de outro tenant.
 *
 * Escopo por papel: admins veem qualquer escala do tenant (transparência). O
 * MEMBRO só vê escala PUBLICADA de ministério em que participa (RN04) — senão 404
 * (não revela rascunho nem ministério alheio). Sem `actor`/`membershipRepo` a
 * leitura não é escopada (comportamento de admin). Dependências via construtor.
 */
export class GetScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly membershipRepo?: MinistryMembershipRepository,
  ) {}

  async execute(dto: GetScheduleDTO): Promise<ScheduleWithAssignments> {
    const schedule = await this.scheduleRepo.findById(dto.id);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    if (dto.actor?.role === 'MEMBRO' && this.membershipRepo) {
      const membership = await this.membershipRepo.findByMemberAndMinistry(
        dto.actor.memberId,
        schedule.ministryId,
      );
      if (schedule.status !== 'PUBLICADA' || !membership) {
        throw new AppError('Escala não encontrada', 404);
      }
    }

    const assignments = await this.assignmentRepo.findByScheduleWithDetails(schedule.id);
    return { schedule, assignments };
  }
}
