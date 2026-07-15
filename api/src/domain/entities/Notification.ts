import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Tipos de notificação previstos no schema (`Notificacao.tipo` é String livre; o
 * conjunto de valores válidos vive aqui, em inglês, e a entidade o garante). O
 * convite NÃO tem tipo: é entrega e-mail-only (quem é convidado ainda não fez
 * login para ver uma inbox in-app).
 */
export type NotificationType =
  | 'ESCALADO'
  | 'INDISPONIBILIDADE_CONFLITO'
  | 'LEMBRETE'
  | 'TROCA'
  | 'SISTEMA';

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'ESCALADO',
  'INDISPONIBILIDADE_CONFLITO',
  'LEMBRETE',
  'TROCA',
  'SISTEMA',
];

/**
 * Notification — registro in-app de um aviso para um membro (Fase 7). Mapeia o
 * model `Notificacao` do Prisma; a tradução PT↔EN acontece só no repositório
 * (Seção 4.6).
 *
 * É o canal CONFIÁVEL das notificações: gravar aqui é o núcleo que sempre
 * acontece; o e-mail (S2) é entrega best-effort por cima. É member-scoped —
 * pertence a UM membro (memberId) e não tem institutionId próprio (o tenant é
 * derivado do membro).
 *
 * Construtor privado + factory create() (Seção 4.1). `read` nasce false; o único
 * estado mutável é marcar como lida, feito recriando via restore() no use case.
 */
export class Notification {
  private constructor(
    public readonly id: string,
    public readonly memberId: string,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly body: string,
    public readonly read: boolean,
    public readonly createdAt: Date,
  ) {}

  /** Cria uma notificação não lida, validando membro, tipo e textos. */
  static create(props: {
    memberId: string;
    type: NotificationType;
    title: string;
    body: string;
  }): Notification {
    if (!props.memberId?.trim()) throw new AppError('Membro é obrigatório', 400);
    if (!NOTIFICATION_TYPES.includes(props.type)) {
      throw new AppError('Tipo de notificação inválido', 400);
    }
    const title = Notification.requireText(props.title, 'Título');
    const body = Notification.requireText(props.body, 'Corpo');

    return new Notification(cuid(), props.memberId, props.type, title, body, false, new Date());
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    memberId: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    createdAt: Date;
  }): Notification {
    return new Notification(
      props.id,
      props.memberId,
      props.type,
      props.title,
      props.body,
      props.read,
      props.createdAt,
    );
  }

  /** Devolve uma cópia marcada como lida (imutabilidade — não muta a instância). */
  markRead(): Notification {
    if (this.read) return this;
    return new Notification(
      this.id,
      this.memberId,
      this.type,
      this.title,
      this.body,
      true,
      this.createdAt,
    );
  }

  /** Texto obrigatório: string não vazia; ausência/tipo errado vira 400, não 500. */
  private static requireText(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(`${label} é obrigatório`, 400);
    }
    return value.trim();
  }
}
