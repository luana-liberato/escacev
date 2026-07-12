import { EventRepository } from '../../repositories/EventRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface DeleteEventDTO {
  institutionId: string;
  id: string;
}

/**
 * Remove um evento da instituição do usuário.
 *
 * Estratégia (mesma filosofia do delete de ministério): o que é COMPARTILHADO
 * bloqueia. O evento é da instituição e vários ministérios podem ter montado
 * suas escalas sobre ele — se existe QUALQUER escala vinculada, a remoção é
 * negada com 409, para não destruir dado que outros ministérios construíram. Sem
 * escalas, remove. Dependência injetada via construtor (Seção 4.2).
 */
export class DeleteEventUseCase {
  constructor(private readonly eventRepo: EventRepository) {}

  async execute(dto: DeleteEventDTO): Promise<void> {
    const event = await this.eventRepo.findById(dto.id);
    if (!event || event.institutionId !== dto.institutionId) {
      throw new AppError('Evento não encontrado', 404);
    }

    const schedules = await this.eventRepo.countSchedules(dto.id);
    if (schedules > 0) {
      throw new AppError(
        'Existem escalas vinculadas a este evento; remova-as antes',
        409,
      );
    }

    await this.eventRepo.delete(dto.id);
  }
}
