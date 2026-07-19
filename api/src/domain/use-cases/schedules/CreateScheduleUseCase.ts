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
  /** Dia do evento a que a escala se refere (fixa o dia em evento multi-dia). */
  date?: Date | null;
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
    // então checar a duplicata pela chave única (ministério, evento, dia, nome).
    const schedule = Schedule.create({
      ministryId: ministry.id,
      eventId: event.id,
      name: dto.name,
      date: dto.date ?? null,
    });

    const existing = await this.scheduleRepo.findByMinistryEventDayAndName(
      ministry.id,
      event.id,
      schedule.date,
      schedule.name,
    );
    if (existing) {
      throw new AppError(
        schedule.name
          ? `Este ministério já tem uma escala "${schedule.name}" para este evento neste dia`
          : 'Este ministério já tem uma escala para este evento neste dia',
        409,
      );
    }

    return this.scheduleRepo.save(schedule);
  }
}
