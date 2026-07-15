import { Notifier } from '../../domain/services/Notifier';
import { CreateNotificationUseCase } from '../../domain/use-cases/notifications/CreateNotificationUseCase';
import { PrismaNotificationRepository } from '../database/repositories/PrismaNotificationRepository';
import { AppNotifier } from './AppNotifier';
import { NodemailerEmailService } from './email';

/**
 * Monta o Notifier de produção (in-app via Prisma + e-mail via SMTP). Ponto único
 * de composição, reusado pelos controllers que disparam notificações (Fase 7) —
 * evita repetir a fiação em cada um. O EmailService lê SMTP do .env e cai em modo
 * log quando não configurado (best-effort).
 */
export function buildNotifier(): Notifier {
  return new AppNotifier(
    new CreateNotificationUseCase(new PrismaNotificationRepository()),
    new NodemailerEmailService(),
  );
}
