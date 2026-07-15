import type { Notificacao as NotificacaoRow } from '@prisma/client';
import { Notification, NotificationType } from '../../../domain/entities/Notification';
import { NotificationRepository } from '../../../domain/repositories/NotificationRepository';
import { prisma } from '../prisma';

export class PrismaNotificationRepository implements NotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    const row = await prisma.notificacao.findUnique({ where: { id } });
    return row ? PrismaNotificationRepository.toEntity(row) : null;
  }

  async findByMember(memberId: string): Promise<Notification[]> {
    const rows = await prisma.notificacao.findMany({
      where: { membroId: memberId },
      orderBy: { criadoEm: 'desc' }, // inbox: mais recentes primeiro
    });
    return rows.map(PrismaNotificationRepository.toEntity);
  }

  async countUnread(memberId: string): Promise<number> {
    return prisma.notificacao.count({ where: { membroId: memberId, lida: false } });
  }

  async save(notification: Notification): Promise<Notification> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.notificacao.create({
      data: {
        id: notification.id,
        membroId: notification.memberId,
        tipo: notification.type,
        titulo: notification.title,
        corpo: notification.body,
        lida: notification.read,
        criadoEm: notification.createdAt,
      },
    });
    return PrismaNotificationRepository.toEntity(row);
  }

  async markAsRead(notification: Notification): Promise<Notification> {
    const row = await prisma.notificacao.update({
      where: { id: notification.id },
      data: { lida: notification.read },
    });
    return PrismaNotificationRepository.toEntity(row);
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: NotificacaoRow): Notification {
    return Notification.restore({
      id: row.id,
      memberId: row.membroId,
      type: row.tipo as NotificationType,
      title: row.titulo,
      body: row.corpo,
      read: row.lida,
      createdAt: row.criadoEm,
    });
  }
}
