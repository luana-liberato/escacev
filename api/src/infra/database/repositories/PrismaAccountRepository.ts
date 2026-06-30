import type { Conta as ContaRow } from '@prisma/client';
import { Account } from '../../../domain/entities/Account';
import { AccountRepository } from '../../../domain/repositories/AccountRepository';
import { prisma } from '../prisma';

export class PrismaAccountRepository implements AccountRepository {
  async findByGoogleSub(googleSub: string): Promise<Account | null> {
    const row = await prisma.conta.findUnique({ where: { googleSub } });
    return row ? PrismaAccountRepository.toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<Account | null> {
    const row = await prisma.conta.findUnique({ where: { email: email.toLowerCase() } });
    return row ? PrismaAccountRepository.toEntity(row) : null;
  }

  async save(account: Account): Promise<Account> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.conta.create({
      data: {
        id: account.id,
        googleSub: account.googleSub,
        email: account.email,
        nomeExibido: account.displayName,
        fotoUrl: account.photoUrl,
        criadoEm: account.createdAt,
      },
    });
    return PrismaAccountRepository.toEntity(row);
  }

  // Colunas em português (schema.prisma) → entidade em inglês.
  private static toEntity(row: ContaRow): Account {
    return Account.restore({
      id: row.id,
      googleSub: row.googleSub,
      email: row.email,
      displayName: row.nomeExibido,
      photoUrl: row.fotoUrl,
      createdAt: row.criadoEm,
    });
  }
}
