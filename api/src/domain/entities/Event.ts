import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Tipos de evento aceitos no domínio, em inglês (Seção 4.6). O schema guarda o
 * valor em português (`tipo`: "culto" | "ensaio" | "especial" | "reuniao" |
 * "cafe" | "conferencia") — a tradução EN↔PT acontece só no repositório. Como
 * `tipo` é String livre no schema (não um enum do Prisma), o domínio define aqui
 * o conjunto fechado e o valida.
 */
export type EventType =
  | 'SERVICE'
  | 'REHEARSAL'
  | 'SPECIAL'
  | 'MEETING'
  | 'COFFEE'
  | 'CONFERENCE';

const EVENT_TYPES: readonly EventType[] = [
  'SERVICE',
  'REHEARSAL',
  'SPECIAL',
  'MEETING',
  'COFFEE',
  'CONFERENCE',
];

/**
 * Event — ocorrência no calendário da instituição (culto, ensaio, especial).
 * É a âncora temporal do motor de conflito (Fase 5): a sobreposição de horários
 * entre eventos é o que gera conflito, então startsAt/endsAt é dado crítico e a
 * entidade garante endsAt > startsAt. Mapeia o model `Evento` do Prisma; a
 * tradução PT↔EN acontece só no repositório (Seção 4.6).
 *
 * Construtor privado + factory create() (padrão da Seção 4.1). Imutável: métodos
 * de mudança devolvem nova instância.
 */
export class Event {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: EventType,
    public readonly startsAt: Date,
    public readonly endsAt: Date,
    public readonly institutionId: string,
    public readonly createdAt: Date,
  ) {}

  /** Cria um evento validando nome, tipo e o intervalo (endsAt > startsAt). */
  static create(props: {
    name: string;
    type: string;
    startsAt: Date;
    endsAt: Date;
    institutionId: string;
  }): Event {
    if (!props.institutionId?.trim()) throw new AppError('Instituição é obrigatória', 400);
    Event.validateInterval(props.startsAt, props.endsAt);

    return new Event(
      cuid(),
      Event.normalizeName(props.name),
      Event.normalizeType(props.type),
      props.startsAt,
      props.endsAt,
      props.institutionId,
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    name: string;
    type: EventType;
    startsAt: Date;
    endsAt: Date;
    institutionId: string;
    createdAt: Date;
  }): Event {
    return new Event(
      props.id,
      props.name,
      props.type,
      props.startsAt,
      props.endsAt,
      props.institutionId,
      props.createdAt,
    );
  }

  /**
   * Retorna uma cópia com os campos atualizados. Instituição e data de criação
   * são imutáveis. Revalida o intervalo com os valores finais (mudar só o início
   * ou só o fim não pode deixar o evento terminando antes de começar).
   */
  update(props: { name?: string; type?: string; startsAt?: Date; endsAt?: Date }): Event {
    const startsAt = props.startsAt !== undefined ? props.startsAt : this.startsAt;
    const endsAt = props.endsAt !== undefined ? props.endsAt : this.endsAt;
    Event.validateInterval(startsAt, endsAt);

    return new Event(
      this.id,
      props.name !== undefined ? Event.normalizeName(props.name) : this.name,
      props.type !== undefined ? Event.normalizeType(props.type) : this.type,
      startsAt,
      endsAt,
      this.institutionId,
      this.createdAt,
    );
  }

  private static normalizeName(name?: string): string {
    // Checa o tipo antes de trim: valor não-string vira 400 tratado, não 500.
    if (typeof name !== 'string' || !name.trim()) {
      throw new AppError('Nome é obrigatório', 400);
    }
    return name.trim();
  }

  private static normalizeType(type?: string): EventType {
    if (typeof type !== 'string' || !EVENT_TYPES.includes(type as EventType)) {
      throw new AppError(
        'Tipo de evento inválido (use SERVICE, REHEARSAL, SPECIAL, MEETING, COFFEE ou CONFERENCE)',
        400,
      );
    }
    return type as EventType;
  }

  private static validateInterval(startsAt: Date, endsAt: Date): void {
    if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
      throw new AppError('Data de início inválida', 400);
    }
    if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
      throw new AppError('Data de término inválida', 400);
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new AppError('O término do evento deve ser depois do início', 400);
    }
  }
}
