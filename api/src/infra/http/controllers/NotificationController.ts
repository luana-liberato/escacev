import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Notification } from '../../../domain/entities/Notification';
import { ListMyNotificationsUseCase } from '../../../domain/use-cases/notifications/ListMyNotificationsUseCase';
import { MarkNotificationReadUseCase } from '../../../domain/use-cases/notifications/MarkNotificationReadUseCase';
import { PrismaNotificationRepository } from '../../database/repositories/PrismaNotificationRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Notificação (Notification) — inbox in-app do membro (Fase 7). É member-scoped:
 * o memberId vem SEMPRE do JWT (req.user), e cada membro lista/marca apenas as
 * PRÓPRIAS notificações — por isso as rotas usam só `auth`, sem `rbac` (qualquer
 * perfil, inclusive MEMBRO). A criação NÃO é exposta por rota: notificações
 * nascem de gatilhos internos do sistema (S2/S3), não de uma chamada do usuário.
 */
export class NotificationController {
  // GET /notificacoes — lista as notificações do próprio membro (mais recentes primeiro).
  listMine = async (req: Request, res: Response): Promise<void> => {
    const { memberId } = NotificationController.authUser(req);

    const useCase = new ListMyNotificationsUseCase(new PrismaNotificationRepository());
    const items = await useCase.execute({ memberId });

    respond(res, 200, items.map(NotificationController.serialize), 'Notificações listadas');
  };

  // PATCH /notificacoes/:id/lida — marca uma notificação do próprio membro como lida.
  markRead = async (req: Request, res: Response): Promise<void> => {
    const { memberId } = NotificationController.authUser(req);

    const useCase = new MarkNotificationReadUseCase(new PrismaNotificationRepository());
    const notification = await useCase.execute({ id: req.params.id, memberId });

    respond(res, 200, NotificationController.serialize(notification), 'Notificação marcada como lida');
  };

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito e devolve 401 caso a rota seja montada sem o auth antes.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** Projeção para a resposta da API. */
  private static serialize(notification: Notification) {
    return {
      id: notification.id,
      memberId: notification.memberId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      createdAt: notification.createdAt,
    };
  }
}
