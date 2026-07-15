import { Notification } from '../entities/Notification';

/**
 * Abstração de persistência da notificação (Notification). Use cases dependem
 * desta interface, nunca do PrismaClient direto (Seção 4.2). É member-scoped: o
 * schema não tem institutionId — o escopo por membro (e, por ele, por
 * instituição) é garantido no use case, com o memberId vindo do JWT.
 */
export interface NotificationRepository {
  /** Notificação por id (sem escopo — o use case valida a posse pelo membro). */
  findById(id: string): Promise<Notification | null>;
  /** Notificações de um membro, mais recentes primeiro (inbox). */
  findByMember(memberId: string): Promise<Notification[]>;
  /** Quantidade de notificações não lidas do membro (badge da inbox). */
  countUnread(memberId: string): Promise<number>;
  /** Persiste uma nova notificação. */
  save(notification: Notification): Promise<Notification>;
  /** Atualiza o estado de leitura (usado ao marcar como lida). */
  markAsRead(notification: Notification): Promise<Notification>;
}
