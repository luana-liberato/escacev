import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { AppError } from '../../../shared/errors/AppError';

/** Filtros opcionais e combináveis. institutionId vem do JWT (req.user). */
export interface ListSchedulesDTO {
  institutionId: string;
  eventId?: string;
  ministryId?: string;
}

/**
 * Lista escalas com filtros opcionais e combináveis:
 *  - eventId    → todas as escalas (de todos os ministérios) daquele evento (visão do evento);
 *  - ministryId → todas as escalas daquele ministério (por vários eventos);
 *  - ambos      → todas as escalas daquele ministério naquele evento (uma por sala/rótulo);
 *  - nenhum     → todas as escalas da instituição.
 * Quando um filtro é dado, o recurso (evento/ministério) é validado no tenant
 * antes de listar — 404 se for de outra instituição, sem vazar. Leitura aberta a
 * qualquer admin (o rbac da rota bloqueia MEMBRO). Dependências via construtor.
 */
export class ListSchedulesUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eventRepo: EventRepository,
  ) {}

  async execute(dto: ListSchedulesDTO): Promise<Schedule[]> {
    if (dto.eventId) await this.ensureEventInInstitution(dto.eventId, dto.institutionId);
    if (dto.ministryId) await this.ensureMinistryInInstitution(dto.ministryId, dto.institutionId);

    if (dto.eventId && dto.ministryId) {
      // Todas as escalas (salas/rótulos) daquele ministério naquele evento.
      return this.scheduleRepo.findByMinistryAndEvent(dto.ministryId, dto.eventId);
    }
    if (dto.eventId) {
      return this.scheduleRepo.findByEvent(dto.eventId, dto.institutionId);
    }
    if (dto.ministryId) {
      return this.scheduleRepo.findByMinistry(dto.ministryId, dto.institutionId);
    }
    return this.scheduleRepo.findByInstitution(dto.institutionId);
  }

  /** 404 se o evento não existe ou é de outra instituição (tenant). */
  private async ensureEventInInstitution(eventId: string, institutionId: string): Promise<void> {
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.institutionId !== institutionId) {
      throw new AppError('Evento não encontrado', 404);
    }
  }

  /** 404 se o ministério não existe ou é de outra instituição (tenant). */
  private async ensureMinistryInInstitution(
    ministryId: string,
    institutionId: string,
  ): Promise<void> {
    const ministry = await this.ministryRepo.findById(ministryId);
    if (!ministry || ministry.institutionId !== institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }
  }
}
