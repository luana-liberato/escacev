import { Account } from '../entities/Account';

/**
 * Abstração de persistência da Account. Use cases dependem desta interface,
 * nunca do PrismaClient diretamente (Seção 4.2 do CLAUDE.md).
 */
export interface AccountRepository {
  findByGoogleSub(googleSub: string): Promise<Account | null>;
  findByEmail(email: string): Promise<Account | null>;
  save(account: Account): Promise<Account>;
}
