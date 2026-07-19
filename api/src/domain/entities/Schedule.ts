import cuid from 'cuid';
import { StatusEscala } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

/**
 * Schedule — a escala de UM ministério para UM evento (model `Escala` do Prisma).
 * É a "casca" que depois é preenchida com alocações (pessoa + função). Nasce
 * vazia com status RASCUNHO e só fica visível ao membro após ser PUBLICADA (RN04).
 *
 * Um ministério pode ter VÁRIAS escalas para o mesmo evento, distinguidas pelo
 * nome/rótulo (ex: infantil com "Berçário", "Sala 1", "Sala 2"). `date` fixa a
 * qual DIA do evento a escala se refere: em evento MULTI-DIA, cada dia pode ter
 * suas escalas. O par é único por (ministério, evento, dia, nome) no schema; nome
 * = "" é a escala única padrão do ministério NAQUELE dia. `date` é uma data pura
 * (sem hora); null = não fixado (evento de um dia, ou escala legada).
 *
 * Construtor privado + factory create() (padrão da Seção 4.1). As propriedades em
 * inglês são traduzidas de/para as colunas em português no repositório (Seção 4.6).
 * O tipo e os valores do status (`RASCUNHO`/`PUBLICADA`) vêm do enum gerado pelo
 * Prisma (StatusEscala), como o PerfilUsuario.
 */
export class Schedule {
  private constructor(
    public readonly id: string,
    public readonly ministryId: string,
    public readonly eventId: string,
    public readonly name: string,
    public readonly date: Date | null,
    public readonly status: StatusEscala,
    public readonly publishedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  /**
   * Cria uma escala vazia (status RASCUNHO, sem data de publicação) de um
   * ministério para um evento. O nome é opcional (rótulo da sala/turma); omitido
   * ou em branco vira "" (a escala única do ministério). `date` é o dia do evento
   * a que a escala se refere (opcional; null quando não fixado). A existência do
   * ministério/evento e o escopo de instituição são validados no use case.
   */
  static create(props: {
    ministryId: string;
    eventId: string;
    name?: string;
    date?: Date | null;
  }): Schedule {
    if (typeof props.ministryId !== 'string' || !props.ministryId.trim()) {
      throw new AppError('Ministério é obrigatório', 400);
    }
    if (typeof props.eventId !== 'string' || !props.eventId.trim()) {
      throw new AppError('Evento é obrigatório', 400);
    }

    return new Schedule(
      cuid(),
      props.ministryId,
      props.eventId,
      Schedule.normalizeName(props.name),
      props.date ?? null,
      'RASCUNHO',
      null,
      new Date(),
    );
  }

  /**
   * Publica a escala: RASCUNHO → PUBLICADA, carimbando `publishedAt` com o
   * instante da publicação. Só a partir daqui a escala fica visível ao membro
   * (RN04). A data da 1ª publicação é DEFINITIVA — republicar é bloqueado (409)
   * para preservar `publicadaEm`, base da precedência por publicação (RN07).
   * Entidade imutável: devolve nova instância, não muta a original.
   */
  publish(): Schedule {
    if (this.status === 'PUBLICADA') {
      throw new AppError('Escala já está publicada', 409);
    }
    return new Schedule(
      this.id,
      this.ministryId,
      this.eventId,
      this.name,
      this.date,
      'PUBLICADA',
      new Date(),
      this.createdAt,
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    ministryId: string;
    eventId: string;
    name: string;
    date: Date | null;
    status: StatusEscala;
    publishedAt: Date | null;
    createdAt: Date;
  }): Schedule {
    return new Schedule(
      props.id,
      props.ministryId,
      props.eventId,
      props.name,
      props.date,
      props.status,
      props.publishedAt,
      props.createdAt,
    );
  }

  /** Nome opcional: ausente/null/branco → "" (escala única do ministério). Não-string → 400. */
  private static normalizeName(name?: string | null): string {
    if (name === undefined || name === null) return '';
    if (typeof name !== 'string') throw new AppError('Nome da escala inválido', 400);
    return name.trim();
  }
}
