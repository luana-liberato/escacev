import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Account — identidade de autenticação (Google OAuth), separada do Member.
 * Uma Account pode estar vinculada a Members em várias instituições (v2).
 * Construtor privado + factory create() (padrão da Seção 4.1 do CLAUDE.md).
 *
 * Mapeia o model `Conta` do Prisma: as propriedades em inglês são traduzidas
 * de/para as colunas em português no repositório (camada de fronteira).
 */
export class Account {
  private constructor(
    public readonly id: string,
    public readonly googleSub: string,
    public readonly email: string,
    public readonly displayName: string | null,
    public readonly photoUrl: string | null,
    public readonly createdAt: Date,
  ) {}

  /** Cria uma nova Account a partir do perfil retornado pelo Google. */
  static create(props: {
    googleSub: string;
    email: string;
    displayName?: string | null;
    photoUrl?: string | null;
  }): Account {
    if (!props.googleSub?.trim()) throw new AppError('googleSub é obrigatório', 400);
    if (!props.email?.trim()) throw new AppError('E-mail é obrigatório', 400);

    return new Account(
      cuid(),
      props.googleSub.trim(),
      props.email.trim().toLowerCase(),
      props.displayName?.trim() || null,
      props.photoUrl?.trim() || null,
      new Date(),
    );
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso dos repositórios). */
  static restore(props: {
    id: string;
    googleSub: string;
    email: string;
    displayName: string | null;
    photoUrl: string | null;
    createdAt: Date;
  }): Account {
    return new Account(
      props.id,
      props.googleSub,
      props.email,
      props.displayName,
      props.photoUrl,
      props.createdAt,
    );
  }
}
