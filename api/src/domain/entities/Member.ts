import cuid from 'cuid';
import { PerfilUsuario } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

/**
 * Member — pessoa dentro de uma instituição (tenant).
 * accountId nulo = convite pendente: o membro foi cadastrado pelo admin mas
 * ainda não fez o primeiro login com Google. Ao logar, a Account é vinculada.
 * Construtor privado + factory create() (padrão da Seção 4.1 do CLAUDE.md).
 *
 * Mapeia o model `Membro` do Prisma: as propriedades em inglês são traduzidas
 * de/para as colunas em português no repositório (camada de fronteira).
 */
export class Member {
  private constructor(
    public readonly id: string,
    public readonly accountId: string | null,
    public readonly institutionId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly role: PerfilUsuario,
    public readonly active: boolean,
    public readonly createdAt: Date,
  ) {}

  /** Cria um novo Member. Sem accountId = convite pendente. */
  static create(props: {
    institutionId: string;
    name: string;
    email: string;
    role?: PerfilUsuario;
    accountId?: string | null;
  }): Member {
    if (!props.institutionId?.trim()) throw new AppError('Instituição é obrigatória', 400);
    if (!props.name?.trim()) throw new AppError('Nome é obrigatório', 400);
    if (!props.email?.trim()) throw new AppError('E-mail é obrigatório', 400);

    return new Member(
      cuid(),
      props.accountId ?? null,
      props.institutionId,
      props.name.trim(),
      props.email.trim().toLowerCase(),
      props.role ?? 'MEMBRO',
      true,
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso dos repositórios). */
  static restore(props: {
    id: string;
    accountId: string | null;
    institutionId: string;
    name: string;
    email: string;
    role: PerfilUsuario;
    active: boolean;
    createdAt: Date;
  }): Member {
    return new Member(
      props.id,
      props.accountId,
      props.institutionId,
      props.name,
      props.email,
      props.role,
      props.active,
      props.createdAt,
    );
  }

  /** true quando o convite ainda não foi aceito (nenhuma Account vinculada). */
  get isPending(): boolean {
    return this.accountId === null;
  }
}
