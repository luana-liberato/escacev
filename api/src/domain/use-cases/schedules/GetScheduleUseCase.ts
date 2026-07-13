import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetScheduleDTO {
  institutionId: string;
  id: string;
}

/**
 * Busca uma escala por id (a "casca"; as alocações virão depois). Valida o tenant
 * pela instituição do ministério da escala — a Escala não tem instituicaoId
 * próprio. Responde 404 quando não existe ou é de outra instituição, sem vazar
 * recursos de outro tenant. Leitura aberta a qualquer admin (o rbac da rota já
 * bloqueia MEMBRO); não passa pela guarda escopada. Dependências via construtor.
 */
export class GetScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: GetScheduleDTO): Promise<Schedule> {
    const schedule = await this.scheduleRepo.findById(dto.id);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    return schedule;
  }
}
