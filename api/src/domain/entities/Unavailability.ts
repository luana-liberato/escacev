import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Unavailability — período em que um membro não pode ser escalado (RN05). Mapeia
 * o model `Indisponibilidade` do Prisma; a tradução PT↔EN acontece só no
 * repositório (Seção 4.6).
 *
 * É member-scoped: pertence a UM membro (via memberId) e NÃO tem institutionId
 * próprio — o schema também não tem (o tenant é derivado do membro). O motor de
 * conflito (Fase 5) consulta a sobreposição destes períodos com o horário do
 * evento ao alertar sobre uma alocação (RN05) — por isso startsAt/endsAt é dado
 * crítico e a entidade garante endsAt > startsAt, como em Event.
 *
 * Construtor privado + factory create() (padrão da Seção 4.1). Imutável — não há
 * edição na Fase 6 (o membro registra e remove; para mudar, remove e recria).
 */
export class Unavailability {
  private constructor(
    public readonly id: string,
    public readonly memberId: string,
    public readonly startsAt: Date,
    public readonly endsAt: Date,
    public readonly reason: string | null,
    public readonly createdAt: Date,
  ) {}

  /** Cria uma indisponibilidade validando o membro e o intervalo (endsAt > startsAt). */
  static create(props: {
    memberId: string;
    startsAt: Date;
    endsAt: Date;
    reason?: string | null;
  }): Unavailability {
    if (!props.memberId?.trim()) throw new AppError('Membro é obrigatório', 400);
    Unavailability.validateInterval(props.startsAt, props.endsAt);

    return new Unavailability(
      cuid(),
      props.memberId,
      props.startsAt,
      props.endsAt,
      Unavailability.normalizeReason(props.reason),
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    memberId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
    createdAt: Date;
  }): Unavailability {
    return new Unavailability(
      props.id,
      props.memberId,
      props.startsAt,
      props.endsAt,
      props.reason,
      props.createdAt,
    );
  }

  /** Motivo é opcional; texto vazio vira null. Valor não-string vira 400, não 500. */
  private static normalizeReason(reason?: string | null): string | null {
    if (reason === undefined || reason === null) return null;
    if (typeof reason !== 'string') throw new AppError('Motivo inválido', 400);
    const trimmed = reason.trim();
    return trimmed === '' ? null : trimmed;
  }

  private static validateInterval(startsAt: Date, endsAt: Date): void {
    if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
      throw new AppError('Data de início inválida', 400);
    }
    if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
      throw new AppError('Data de término inválida', 400);
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new AppError('O término da indisponibilidade deve ser depois do início', 400);
    }
  }
}
