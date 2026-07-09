import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Position — função exercida dentro de um ministério (ex: baterista, vocal,
 * pregador). É a posição que um membro ocupa ao ser alocado num evento; o membro
 * NÃO tem função fixa — ela é atribuída só na escala.
 *
 * Nome em inglês "Position" para não colidir com `role`, que já é o perfil do
 * usuário no JWT. Mapeia o model `Funcao` do Prisma; a tradução PT↔EN acontece
 * só no repositório (Seção 4.6).
 *
 * Construtor privado + factory create() (padrão da Seção 4.1).
 */
export class Position {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly ministryId: string,
    public readonly createdAt: Date,
  ) {}

  /** Cria uma nova função validando nome obrigatório e o ministério de origem. */
  static create(props: { name: string; ministryId: string }): Position {
    if (!props.ministryId?.trim()) throw new AppError('Ministério é obrigatório', 400);

    return new Position(
      cuid(),
      Position.normalizeName(props.name),
      props.ministryId,
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    name: string;
    ministryId: string;
    createdAt: Date;
  }): Position {
    return new Position(props.id, props.name, props.ministryId, props.createdAt);
  }

  /**
   * Retorna uma cópia com o nome atualizado. Ministério e data de criação são
   * imutáveis. Entidade imutável: valida e devolve nova instância.
   */
  update(props: { name?: string }): Position {
    return new Position(
      this.id,
      props.name !== undefined ? Position.normalizeName(props.name) : this.name,
      this.ministryId,
      this.createdAt,
    );
  }

  private static normalizeName(name?: string): string {
    if (!name?.trim()) throw new AppError('Nome é obrigatório', 400);
    return name.trim();
  }
}
