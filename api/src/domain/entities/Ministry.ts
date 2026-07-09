import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Ministry — grupo dentro da instituição (ex: louvor, recepção, mídia).
 * Construtor privado + factory create() (padrão da Seção 4.1 do CLAUDE.md).
 *
 * Mapeia o model `Ministerio` do Prisma: as propriedades em inglês são
 * traduzidas de/para as colunas em português no repositório (camada de fronteira).
 */
export class Ministry {
  private constructor(
    public readonly id: string,
    public readonly institutionId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly createdAt: Date,
  ) {}

  /** Cria um novo Ministry validando os campos obrigatórios. */
  static create(props: {
    institutionId: string;
    name: string;
    description?: string | null;
  }): Ministry {
    if (!props.institutionId?.trim()) throw new AppError('Instituição é obrigatória', 400);

    return new Ministry(
      cuid(),
      props.institutionId,
      Ministry.normalizeName(props.name),
      Ministry.normalizeDescription(props.description),
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso dos repositórios). */
  static restore(props: {
    id: string;
    institutionId: string;
    name: string;
    description: string | null;
    createdAt: Date;
  }): Ministry {
    return new Ministry(
      props.id,
      props.institutionId,
      props.name,
      props.description,
      props.createdAt,
    );
  }

  /**
   * Retorna uma cópia com nome e/ou descrição atualizados. Campos omitidos
   * (undefined) permanecem inalterados; description null limpa a descrição.
   * Entidade imutável: valida e devolve nova instância (não muta a original).
   */
  update(props: { name?: string; description?: string | null }): Ministry {
    return new Ministry(
      this.id,
      this.institutionId,
      props.name !== undefined ? Ministry.normalizeName(props.name) : this.name,
      props.description !== undefined
        ? Ministry.normalizeDescription(props.description)
        : this.description,
      this.createdAt,
    );
  }

  private static normalizeName(name?: string): string {
    // Checa o tipo antes de trim: um valor não-string (número, lista) no body
    // vira 400 tratado, em vez de estourar TypeError → 500.
    if (typeof name !== 'string' || !name.trim()) {
      throw new AppError('Nome é obrigatório', 400);
    }
    return name.trim();
  }

  /** Descrição em branco vira null (coluna opcional no schema). */
  private static normalizeDescription(description?: string | null): string | null {
    // Ausente/null → null; se vier valor, exige string (não-string vira 400, não 500).
    if (description === undefined || description === null) return null;
    if (typeof description !== 'string') throw new AppError('Descrição inválida', 400);
    const value = description.trim();
    return value ? value : null;
  }
}
