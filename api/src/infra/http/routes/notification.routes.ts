import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { NotificationController } from '../controllers/NotificationController';

/**
 * Notificação (Notification) — inbox in-app do membro (Fase 7). Member-scoped: só
 * `auth`, sem `rbac` — qualquer perfil autenticado (inclusive MEMBRO) age sobre
 * as PRÓPRIAS notificações; o memberId vem do JWT e os use cases validam a posse.
 * Não há rota de criação: notificações nascem de gatilhos internos (S2/S3).
 */
export const notificationRoutes = Router();
const controller = new NotificationController();

notificationRoutes.get('/notificacoes', auth, asyncHandler(controller.listMine));

notificationRoutes.patch('/notificacoes/:id/lida', auth, asyncHandler(controller.markRead));
