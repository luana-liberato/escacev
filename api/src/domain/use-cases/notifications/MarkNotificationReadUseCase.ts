import { Notification } from '../../entities/Notification';
import { NotificationRepository } from '../../repositories/NotificationRepository';
import { AppError } from '../../../shared/errors/AppError';

/** memberId vem do JWT (req.user): o membro só marca as PRÓPRIAS notificações. */
export interface MarkNotificationReadDTO {
  id: string;
  memberId: string;
}

/**
 * Marca uma notificação do próprio membro como lida. Responde 404 quando não
 * existe OU pertence a outro membro — não vaza a existência de dados de terceiros
 * (mesma filosofia de posse dos demais use cases member-scoped). Idempotente:
 * marcar de novo uma já lida é no-op e devolve a própria notificação.
 */
export class MarkNotificationReadUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(dto: MarkNotificationReadDTO): Promise<Notification> {
    const notification = await this.notificationRepo.findById(dto.id);
    if (!notification || notification.memberId !== dto.memberId) {
      throw new AppError('Notificação não encontrada', 404);
    }
    if (notification.read) return notification; // idempotente: já estava lida
    return this.notificationRepo.markAsRead(notification.markRead());
  }
}
