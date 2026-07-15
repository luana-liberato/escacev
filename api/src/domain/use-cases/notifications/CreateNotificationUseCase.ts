import { Notification, NotificationType } from '../../entities/Notification';
import { NotificationRepository } from '../../repositories/NotificationRepository';

/**
 * Dados de uma notificação a criar. memberId é o DESTINATÁRIO — diferente dos
 * use cases member-scoped da inbox (onde vem do JWT): aqui quem cria é o sistema
 * (ao publicar escala, ao detectar conflito de indisponibilidade etc.), então o
 * destinatário é escolhido pelo gatilho, não pelo autor da ação.
 */
export interface CreateNotificationDTO {
  memberId: string;
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * Cria e persiste uma notificação in-app. É o núcleo confiável do canal (Fase 7):
 * o Notifier (S2) chama este use case para gravar a notificação e, por cima,
 * dispara o e-mail best-effort. Dependência injetada via construtor (Seção 4.2).
 */
export class CreateNotificationUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(dto: CreateNotificationDTO): Promise<Notification> {
    const notification = Notification.create(dto);
    return this.notificationRepo.save(notification);
  }
}
