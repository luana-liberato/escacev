import { Event } from '../../entities/Event';
import { EventRepository } from '../../repositories/EventRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetEventDTO {
  institutionId: string;
  id: string;
}

/**
 * Busca um evento por id garantindo que pertence à instituição do usuário
 * (tenant). Responde 404 quando não existe ou é de outra instituição — não
 * vaza a existência de eventos de outros tenants. Dependência via construtor.
 */
export class GetEventUseCase {
  constructor(private readonly eventRepo: EventRepository) {}

  async execute(dto: GetEventDTO): Promise<Event> {
    const event = await this.eventRepo.findById(dto.id);
    if (!event || event.institutionId !== dto.institutionId) {
      throw new AppError('Evento não encontrado', 404);
    }
    return event;
  }
}
