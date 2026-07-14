import cuid from 'cuid';
import { StatusEscala } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

/**
 * Schedule — a escala de UM ministério para UM evento (model `Escala` do Prisma).
 * É a "casca" que depois é preenchida com alocações (pessoa + função). Nasce
 * vazia com status RASCUNHO e só fica visível ao membro após ser PUBLICADA (RN04);
 * a publicação e as alocações entram em blocos posteriores da Fase 5.
 *
 * Um ministério pode ter VÁRIAS escalas para o mesmo evento, distinguidas pelo
 * nome/rótulo (ex: infantil com "Berçário", "Sala 1", "Sala 2"). O par é único por
 * (ministério, evento, nome) no schema; nome = "" é a escala única padrão do
 * ministério — o segundo "" no mesmo evento colide (preserva "um ministério = uma
 * escala por evento" no caso comum).
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
    public readonly status: StatusEscala,
    public readonly publishedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  /**
   * Cria uma escala vazia (status RASCUNHO, sem data de publicação) de um
   * ministério para um evento. O nome é opcional (rótulo da sala/turma); omitido
   * ou em branco vira "" (a escala única do ministério). A existência do
   * ministério/evento e o escopo de instituição são validados no use case; aqui
   * garantimos apenas os ids e normalizamos o nome.
   */
  static create(props: { ministryId: string; eventId: string; name?: string }): Schedule {
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
    status: StatusEscala;
    publishedAt: Date | null;
    createdAt: Date;
  }): Schedule {
    return new Schedule(
      props.id,
      props.ministryId,
      props.eventId,
      props.name,
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
