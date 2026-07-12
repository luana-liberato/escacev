import { Event } from '../../entities/Event';
import { EventRepository } from '../../repositories/EventRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. Campos ausentes não mudam. */
export interface UpdateEventDTO {
  institutionId: string;
  id: string;
  name?: string;
  type?: string;
  startsAt?: Date;
  endsAt?: Date;
}

/**
 * Atualiza nome, tipo e horários de um evento da instituição do usuário. A
 * entidade revalida o intervalo (endsAt > startsAt) mesmo quando só um dos
 * limites muda. 404 quando o evento não existe ou é de outra instituição.
 * Dependência injetada via construtor (Seção 4.2).
 */
export class UpdateEventUseCase {
  constructor(private readonly eventRepo: EventRepository) {}

  async execute(dto: UpdateEventDTO): Promise<Event> {
    const event = await this.eventRepo.findById(dto.id);
    if (!event || event.institutionId !== dto.institutionId) {
      throw new AppError('Evento não encontrado', 404);
    }

    const updated = event.update({
      name: dto.name,
      type: dto.type,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    });
    return this.eventRepo.update(updated);
  }
}
