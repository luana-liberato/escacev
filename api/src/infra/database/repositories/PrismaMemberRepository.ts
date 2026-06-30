import type { Membro as MembroRow } from '@prisma/client';
import { Member } from '../../../domain/entities/Member';
import { MemberRepository } from '../../../domain/repositories/MemberRepository';
import { prisma } from '../prisma';

export class PrismaMemberRepository implements MemberRepository {
  async findByAccountId(accountId: string): Promise<Member | null> {
    const row = await prisma.membro.findFirst({ where: { contaId: accountId } });
    return row ? PrismaMemberRepository.toEntity(row) : null;
  }

  async findPendingByEmail(email: string): Promise<Member | null> {
    const row = await prisma.membro.findFirst({
      where: { email: email.toLowerCase(), contaId: null, ativo: true },
    });
    return row ? PrismaMemberRepository.toEntity(row) : null;
  }

  async linkAccount(memberId: string, accountId: string): Promise<Member> {
    const row = await prisma.membro.update({
      where: { id: memberId },
      data: { contaId: accountId },
    });
    return PrismaMemberRepository.toEntity(row);
  }

  // Colunas em português (schema.prisma) → entidade em inglês.
  private static toEntity(row: MembroRow): Member {
    return Member.restore({
      id: row.id,
      accountId: row.contaId,
      institutionId: row.instituicaoId,
      name: row.nome,
      email: row.email,
      role: row.perfil,
      active: row.ativo,
      createdAt: row.criadoEm,
    });
  }
}
