import type { Membro as MembroRow } from '@prisma/client';
import { Member } from '../../../domain/entities/Member';
import { MemberRepository } from '../../../domain/repositories/MemberRepository';
import { prisma } from '../prisma';

export class PrismaMemberRepository implements MemberRepository {
  async findById(id: string): Promise<Member | null> {
    const row = await prisma.membro.findUnique({ where: { id } });
    return row ? PrismaMemberRepository.toEntity(row) : null;
  }

  async findByAccountId(accountId: string): Promise<Member | null> {
    const row = await prisma.membro.findFirst({ where: { contaId: accountId } });
    return row ? PrismaMemberRepository.toEntity(row) : null;
  }

  async findByEmailAndInstitution(email: string, institutionId: string): Promise<Member | null> {
    const row = await prisma.membro.findFirst({
      where: { email: email.toLowerCase(), instituicaoId: institutionId },
    });
    return row ? PrismaMemberRepository.toEntity(row) : null;
  }

  async findByInstitution(institutionId: string): Promise<Member[]> {
    const rows = await prisma.membro.findMany({
      where: { instituicaoId: institutionId },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaMemberRepository.toEntity);
  }

  async findPendingByEmail(email: string): Promise<Member | null> {
    const row = await prisma.membro.findFirst({
      where: { email: email.toLowerCase(), contaId: null, ativo: true },
    });
    return row ? PrismaMemberRepository.toEntity(row) : null;
  }

  async save(member: Member): Promise<Member> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.membro.create({
      data: {
        id: member.id,
        contaId: member.accountId,
        instituicaoId: member.institutionId,
        nome: member.name,
        email: member.email,
        perfil: member.role,
        ativo: member.active,
        criadoEm: member.createdAt,
      },
    });
    return PrismaMemberRepository.toEntity(row);
  }

  async update(member: Member): Promise<Member> {
    // Somente nome, perfil e status ativo são mutáveis (e-mail e instituição não).
    const row = await prisma.membro.update({
      where: { id: member.id },
      data: {
        nome: member.name,
        perfil: member.role,
        ativo: member.active,
      },
    });
    return PrismaMemberRepository.toEntity(row);
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
