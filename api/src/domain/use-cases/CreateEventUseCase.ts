import { Event } from '../entities/Event';
import { EventRepository } from '../repositories/EventRepository';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface CreateEventDTO {
  institutionId: string;
  name: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Cria um evento no calendário da instituição do usuário. A validação de nome,
 * tipo e do intervalo (endsAt > startsAt) mora na entidade; o use case orquestra
 * e persiste. Dependência injetada via construtor (Seção 4.2).
 */
export class CreateEventUseCase {
  constructor(private readonly eventRepo: EventRepository) {}

  async execute(dto: CreateEventDTO): Promise<Event> {
    const event = Event.create({
      name: dto.name,
      type: dto.type,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      institutionId: dto.institutionId,
    });
    return this.eventRepo.save(event);
  }
}
