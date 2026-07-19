import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AssignmentDetail, AssignmentRepository } from '../../repositories/AssignmentRepository';
import { Actor } from '../../services/MinistryAccessPolicy';
import { ScheduleVisibilityPolicy } from '../../services/ScheduleVisibilityPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetScheduleDTO {
  institutionId: string;
  id: string;
  /** Ator autenticado — usado para escopar a visão por participação. */
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
 * Escopo por papel (ScheduleVisibilityPolicy): ADMIN_GERAL vê qualquer escala do
 * tenant. O ADMIN_MINISTERIO só alcança escala de ministério que participa —
 * inclusive rascunho onde é admin, só publicada onde é apenas membro; o MEMBRO só
 * escala PUBLICADA de ministério que participa (RN04). Fora disso 404 (não revela
 * rascunho nem ministério alheio). Sem `actor`/`visibilityPolicy` a leitura não é
 * escopada. Dependências via construtor.
 */
export class GetScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly visibilityPolicy?: ScheduleVisibilityPolicy,
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

    if (dto.actor && this.visibilityPolicy) {
      if (!(await this.visibilityPolicy.canView(dto.actor, schedule))) {
        throw new AppError('Escala não encontrada', 404);
      }
    }

    const assignments = await this.assignmentRepo.findByScheduleWithDetails(schedule.id);
    return { schedule, assignments };
  }
}
