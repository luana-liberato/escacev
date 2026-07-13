import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. name é opcional (rótulo). */
export interface CreateScheduleDTO {
  institutionId: string;
  actor: Actor;
  ministryId: string;
  eventId: string;
  name?: string;
}

/**
 * Cria a escala (vazia, status RASCUNHO) de um ministério para um evento.
 * Valida que o ministério e o evento pertencem à instituição do usuário (tenant),
 * que o ator administra aquele ministério (Permissão Escopada — reusa a
 * MinistryAccessPolicy) e impede duplicata pelo trio ministério+evento+nome. O
 * nome distingue várias escalas do mesmo ministério no mesmo evento (ex: salas do
 * infantil); nome "" é a escala única padrão. Dependências via construtor (4.2).
 */
export class CreateScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eventRepo: EventRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: CreateScheduleDTO): Promise<Schedule> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    const event = await this.eventRepo.findById(dto.eventId);
    if (!event || event.institutionId !== dto.institutionId) {
      throw new AppError('Evento não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    // Cria a entidade primeiro para normalizar o nome (trim, "" quando omitido) e
    // então checar a duplicata pelo trio único (ministério, evento, nome).
    const schedule = Schedule.create({
      ministryId: ministry.id,
      eventId: event.id,
      name: dto.name,
    });

    const existing = await this.scheduleRepo.findByMinistryEventAndName(
      ministry.id,
      event.id,
      schedule.name,
    );
    if (existing) {
      throw new AppError(
        schedule.name
          ? `Este ministério já tem uma escala "${schedule.name}" para este evento`
          : 'Este ministério já tem uma escala para este evento',
        409,
      );
    }

    return this.scheduleRepo.save(schedule);
  }
}
