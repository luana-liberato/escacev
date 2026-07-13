import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AssignmentDetail, AssignmentRepository } from '../../repositories/AssignmentRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetScheduleDTO {
  institutionId: string;
  id: string;
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
 * instituição, sem vazar recursos de outro tenant. Leitura aberta a qualquer
 * admin (o rbac da rota já bloqueia MEMBRO); não passa pela guarda escopada.
 * Dependências via construtor (Seção 4.2).
 */
export class GetScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly assignmentRepo: AssignmentRepository,
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

    const assignments = await this.assignmentRepo.findByScheduleWithDetails(schedule.id);
    return { schedule, assignments };
  }
}
