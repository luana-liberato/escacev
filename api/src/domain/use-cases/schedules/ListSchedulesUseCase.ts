import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { Actor } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** Filtros opcionais e combináveis. institutionId vem do JWT (req.user). */
export interface ListSchedulesDTO {
  institutionId: string;
  eventId?: string;
  ministryId?: string;
  /** Ator autenticado — usado só para escopar a visão do MEMBRO (ver abaixo). */
  actor?: Actor;
}

/**
 * Lista escalas com filtros opcionais e combináveis:
 *  - eventId    → todas as escalas (de todos os ministérios) daquele evento (visão do evento);
 *  - ministryId → todas as escalas daquele ministério (por vários eventos);
 *  - ambos      → todas as escalas daquele ministério naquele evento (uma por sala/rótulo);
 *  - nenhum     → todas as escalas da instituição.
 * Quando um filtro é dado, o recurso (evento/ministério) é validado no tenant
 * antes de listar — 404 se for de outra instituição, sem vazar.
 *
 * Escopo por papel: admins veem tudo (transparência da visão do evento). O MEMBRO
 * vê SÓ escalas PUBLICADA de ministérios em que participa (RN04) — o filtro é
 * aplicado sobre o resultado. Sem `actor` (ou sem `membershipRepo`) a listagem
 * não é escopada, preservando o comportamento de admin. Dependências via construtor.
 */
export class ListSchedulesUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eventRepo: EventRepository,
    private readonly membershipRepo?: MinistryMembershipRepository,
  ) {}

  async execute(dto: ListSchedulesDTO): Promise<Schedule[]> {
    if (dto.eventId) await this.ensureEventInInstitution(dto.eventId, dto.institutionId);
    if (dto.ministryId) await this.ensureMinistryInInstitution(dto.ministryId, dto.institutionId);

    const result = await this.fetch(dto);

    if (dto.actor?.role === 'MEMBRO' && this.membershipRepo) {
      return this.scopeForMember(result, dto.actor.memberId);
    }
    return result;
  }

  /** Aplica os filtros de evento/ministério (já validados) à consulta. */
  private fetch(dto: ListSchedulesDTO): Promise<Schedule[]> {
    if (dto.eventId && dto.ministryId) {
      // Todas as escalas (salas/rótulos) daquele ministério naquele evento.
      return this.scheduleRepo.findByMinistryAndEvent(dto.ministryId, dto.eventId);
    }
    if (dto.eventId) return this.scheduleRepo.findByEvent(dto.eventId, dto.institutionId);
    if (dto.ministryId) return this.scheduleRepo.findByMinistry(dto.ministryId, dto.institutionId);
    return this.scheduleRepo.findByInstitution(dto.institutionId);
  }

  /**
   * Visão do MEMBRO (RN04): só escalas PUBLICADA, e só de ministérios em que ele
   * participa. Consulta o vínculo uma vez por ministério presente no resultado.
   */
  private async scopeForMember(schedules: Schedule[], memberId: string): Promise<Schedule[]> {
    const published = schedules.filter((s) => s.status === 'PUBLICADA');
    const allowed = new Set<string>();
    for (const ministryId of new Set(published.map((s) => s.ministryId))) {
      const membership = await this.membershipRepo!.findByMemberAndMinistry(memberId, ministryId);
      if (membership) allowed.add(ministryId);
    }
    return published.filter((s) => allowed.has(s.ministryId));
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
