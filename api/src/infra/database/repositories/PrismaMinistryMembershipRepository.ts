import type {
  MembroMinisterio as MembroMinisterioRow,
  Membro as MembroRow,
  Ministerio as MinisterioRow,
} from '@prisma/client';
import { Member } from '../../../domain/entities/Member';
import { Ministry } from '../../../domain/entities/Ministry';
import { MinistryMembership } from '../../../domain/entities/MinistryMembership';
import {
  MemberMinistryLink,
  MemberMinistryView,
  MinistryMemberView,
  MinistryMembershipRepository,
} from '../../../domain/repositories/MinistryMembershipRepository';
import { prisma } from '../prisma';

export class PrismaMinistryMembershipRepository implements MinistryMembershipRepository {
  async findByMemberAndMinistry(
    memberId: string,
    ministryId: string,
  ): Promise<MinistryMembership | null> {
    const row = await prisma.membroMinisterio.findUnique({
      where: { membroId_ministerioId: { membroId: memberId, ministerioId: ministryId } },
    });
    return row ? PrismaMinistryMembershipRepository.toEntity(row) : null;
  }

  async findMembersByMinistry(ministryId: string): Promise<MinistryMemberView[]> {
    const rows = await prisma.membroMinisterio.findMany({
      where: { ministerioId: ministryId },
      orderBy: { criadoEm: 'asc' },
      include: { membro: true },
    });
    return rows.map((row) => ({
      membership: PrismaMinistryMembershipRepository.toEntity(row),
      member: PrismaMinistryMembershipRepository.memberToEntity(row.membro),
    }));
  }

  async findMinistriesByMember(memberId: string): Promise<MemberMinistryView[]> {
    const rows = await prisma.membroMinisterio.findMany({
      where: { membroId: memberId },
      orderBy: { criadoEm: 'asc' },
      include: { ministerio: true },
    });
    return rows.map((row) => ({
      membership: PrismaMinistryMembershipRepository.toEntity(row),
      ministry: PrismaMinistryMembershipRepository.ministryToEntity(row.ministerio),
    }));
  }

  async save(membership: MinistryMembership): Promise<MinistryMembership> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.membroMinisterio.create({
      data: {
        id: membership.id,
        membroId: membership.memberId,
        ministerioId: membership.ministryId,
        isAdmin: membership.isAdmin,
        criadoEm: membership.createdAt,
      },
    });
    return PrismaMinistryMembershipRepository.toEntity(row);
  }

  async update(membership: MinistryMembership): Promise<MinistryMembership> {
    // Apenas o papel de admin (isAdmin) é mutável no vínculo.
    const row = await prisma.membroMinisterio.update({
      where: { id: membership.id },
      data: { isAdmin: membership.isAdmin },
    });
    return PrismaMinistryMembershipRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.membroMinisterio.delete({ where: { id } });
  }

  async replaceForMember(memberId: string, links: MemberMinistryLink[]): Promise<void> {
    const current = await prisma.membroMinisterio.findMany({
      where: { membroId: memberId },
      select: { ministerioId: true, isAdmin: true },
    });
    const wanted = new Map(links.map((link) => [link.ministryId, link.isAdmin]));

    const toRemove = current
      .filter((row) => !wanted.has(row.ministerioId))
      .map((row) => row.ministerioId);
    const toAdd = links.filter(
      (link) => !current.some((row) => row.ministerioId === link.ministryId),
    );
    // Permaneceu, mas trocou de papel: promovido ou rebaixado.
    const toUpdate = current.filter(
      (row) => wanted.has(row.ministerioId) && wanted.get(row.ministerioId) !== row.isAdmin,
    );

    // Nada mudou: evita abrir transação à toa.
    if (toRemove.length === 0 && toAdd.length === 0 && toUpdate.length === 0) return;

    await prisma.$transaction([
      ...(toRemove.length > 0
        ? [
            prisma.membroMinisterio.deleteMany({
              where: { membroId: memberId, ministerioId: { in: toRemove } },
            }),
          ]
        : []),
      ...toAdd.map((link) =>
        prisma.membroMinisterio.create({
          data: { membroId: memberId, ministerioId: link.ministryId, isAdmin: link.isAdmin },
        }),
      ),
      ...toUpdate.map((row) =>
        prisma.membroMinisterio.update({
          where: { membroId_ministerioId: { membroId: memberId, ministerioId: row.ministerioId } },
          data: { isAdmin: wanted.get(row.ministerioId)! },
        }),
      ),
    ]);
  }

  // Colunas em português (schema.prisma) → entidade em inglês.
  private static toEntity(row: MembroMinisterioRow): MinistryMembership {
    return MinistryMembership.restore({
      id: row.id,
      memberId: row.membroId,
      ministryId: row.ministerioId,
      isAdmin: row.isAdmin,
      createdAt: row.criadoEm,
    });
  }

  private static memberToEntity(row: MembroRow): Member {
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

  private static ministryToEntity(row: MinisterioRow): Ministry {
    return Ministry.restore({
      id: row.id,
      institutionId: row.instituicaoId,
      name: row.nome,
      description: row.descricao,
      createdAt: row.criadoEm,
    });
  }
}
