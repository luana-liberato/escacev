import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * MinistryMembership — vínculo entre um Member e um Ministry (model
 * `MembroMinisterio` do Prisma). Existir o vínculo = o membro PARTICIPA do
 * ministério (pode ser escalado). isAdmin = true = além de participar, também
 * ADMINISTRA aquele ministério (Seção 1 do CLAUDE.md).
 *
 * Construtor privado + factory create() (padrão da Seção 4.1). As propriedades
 * em inglês são traduzidas de/para as colunas em português no repositório.
 */
export class MinistryMembership {
  private constructor(
    public readonly id: string,
    public readonly memberId: string,
    public readonly ministryId: string,
    public readonly isAdmin: boolean,
    public readonly createdAt: Date,
  ) {}

  /** Cria um novo vínculo. isAdmin é opcional e nasce false (só participa). */
  static create(props: {
    memberId: string;
    ministryId: string;
    isAdmin?: boolean;
  }): MinistryMembership {
    if (!props.memberId?.trim()) throw new AppError('Membro é obrigatório', 400);
    if (!props.ministryId?.trim()) throw new AppError('Ministério é obrigatório', 400);

    return new MinistryMembership(
      cuid(),
      props.memberId,
      props.ministryId,
      props.isAdmin ?? false,
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso dos repositórios). */
  static restore(props: {
    id: string;
    memberId: string;
    ministryId: string;
    isAdmin: boolean;
    createdAt: Date;
  }): MinistryMembership {
    return new MinistryMembership(
      props.id,
      props.memberId,
      props.ministryId,
      props.isAdmin,
      props.createdAt,
    );
  }

  /**
   * Retorna uma cópia com o papel de admin alternado (promover/rebaixar).
   * Entidade imutável: não muta a original.
   */
  setAdmin(isAdmin: boolean): MinistryMembership {
    return new MinistryMembership(
      this.id,
      this.memberId,
      this.ministryId,
      isAdmin,
      this.createdAt,
    );
  }
}
