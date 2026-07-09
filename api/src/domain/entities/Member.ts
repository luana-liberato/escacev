import cuid from 'cuid';
import { PerfilUsuario } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

/** Formato mínimo de e-mail: algo@algo.dominio (sem espaços). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    return new Member(
      cuid(),
      props.accountId ?? null,
      props.institutionId,
      Member.normalizeName(props.name),
      Member.normalizeEmail(props.email),
      Member.normalizeRole(props.role),
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

  /**
   * Retorna uma cópia com nome, perfil e/ou status ativo atualizados.
   * Campos omitidos permanecem inalterados. E-mail e instituição são imutáveis.
   * Entidade imutável: valida e devolve nova instância (não muta a original).
   */
  update(props: { name?: string; role?: PerfilUsuario; active?: boolean }): Member {
    return new Member(
      this.id,
      this.accountId,
      this.institutionId,
      props.name !== undefined ? Member.normalizeName(props.name) : this.name,
      this.email,
      props.role !== undefined ? Member.normalizeRole(props.role) : this.role,
      props.active !== undefined ? props.active : this.active,
      this.createdAt,
    );
  }

  /** Retorna uma cópia desativada (soft delete via campo ativo). */
  deactivate(): Member {
    return new Member(
      this.id,
      this.accountId,
      this.institutionId,
      this.name,
      this.email,
      this.role,
      false,
      this.createdAt,
    );
  }

  /** true quando o convite ainda não foi aceito (nenhuma Account vinculada). */
  get isPending(): boolean {
    return this.accountId === null;
  }

  private static normalizeName(name?: string): string {
    // Checa o tipo antes de trim: um valor não-string (número, lista) no body
    // vira 400 tratado, em vez de estourar TypeError → 500.
    if (typeof name !== 'string' || !name.trim()) {
      throw new AppError('Nome é obrigatório', 400);
    }
    return name.trim();
  }

  private static normalizeEmail(email?: string): string {
    // Tipo antes de trim: e-mail não-string no body vira 400, não TypeError → 500.
    if (typeof email !== 'string') throw new AppError('E-mail é obrigatório', 400);
    const value = email.trim().toLowerCase();
    if (!value) throw new AppError('E-mail é obrigatório', 400);
    if (!EMAIL_REGEX.test(value)) throw new AppError('E-mail inválido', 400);
    return value;
  }

  private static normalizeRole(role?: PerfilUsuario | null): PerfilUsuario {
    if (role === undefined || role === null) return 'MEMBRO';
    if (!Object.values(PerfilUsuario).includes(role)) {
      throw new AppError('Perfil inválido', 400);
    }
    return role;
  }
}
