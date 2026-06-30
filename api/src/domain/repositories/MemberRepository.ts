import { Member } from '../entities/Member';

/**
 * Abstração de persistência do Member. Use cases dependem desta interface,
 * nunca do PrismaClient diretamente (Seção 4.2 do CLAUDE.md).
 */
export interface MemberRepository {
  /** Member já vinculado a uma Account. */
  findByAccountId(accountId: string): Promise<Member | null>;
  /** Convite pendente (accountId nulo) correspondente ao e-mail. */
  findPendingByEmail(email: string): Promise<Member | null>;
  /** Vincula a Account ao Member (aceite do convite) e retorna o Member atualizado. */
  linkAccount(memberId: string, accountId: string): Promise<Member>;
}
