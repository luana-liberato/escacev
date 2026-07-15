import { Notification } from '../../entities/Notification';
import { NotificationRepository } from '../../repositories/NotificationRepository';

/** memberId vem do JWT (req.user): o membro lista só as PRÓPRIAS notificações. */
export interface ListMyNotificationsDTO {
  memberId: string;
}

/**
 * Lista as notificações do próprio membro, mais recentes primeiro (inbox).
 * Dependência injetada via construtor (Seção 4.2).
 */
export class ListMyNotificationsUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(dto: ListMyNotificationsDTO): Promise<Notification[]> {
    return this.notificationRepo.findByMember(dto.memberId);
  }
}
