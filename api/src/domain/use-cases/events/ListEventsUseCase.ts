import { Event } from '../../entities/Event';
import { EventRepository } from '../../repositories/EventRepository';

/**
 * institutionId vem do JWT (req.user). `from`/`to` são o filtro opcional de
 * período (a agenda consulta por mês/semana). Sem filtro, retorna todos os
 * eventos da instituição.
 */
export interface ListEventsDTO {
  institutionId: string;
  from?: Date;
  to?: Date;
}

/**
 * Lista os eventos da instituição, em ordem cronológica, com filtro opcional por
 * período (sobreposição com [from, to]). Eventos simultâneos são permitidos e
 * normais. Dependência injetada via construtor (Seção 4.2).
 */
export class ListEventsUseCase {
  constructor(private readonly eventRepo: EventRepository) {}

  async execute(dto: ListEventsDTO): Promise<Event[]> {
    return this.eventRepo.findByInstitution(dto.institutionId, {
      from: dto.from,
      to: dto.to,
    });
  }
}
