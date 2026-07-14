import type { Indisponibilidade as IndisponibilidadeRow } from '@prisma/client';
import { Unavailability } from '../../../domain/entities/Unavailability';
import { UnavailabilityRepository } from '../../../domain/repositories/UnavailabilityRepository';
import { prisma } from '../prisma';

export class PrismaUnavailabilityRepository implements UnavailabilityRepository {
  async findById(id: string): Promise<Unavailability | null> {
    const row = await prisma.indisponibilidade.findUnique({ where: { id } });
    return row ? PrismaUnavailabilityRepository.toEntity(row) : null;
  }

  async findByMember(memberId: string): Promise<Unavailability[]> {
    const rows = await prisma.indisponibilidade.findMany({
      where: { membroId: memberId },
      orderBy: { inicio: 'asc' },
    });
    return rows.map(PrismaUnavailabilityRepository.toEntity);
  }

  async findByMemberOverlapping(
    memberId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<Unavailability[]> {
    // Sobreposição estrita: inicio < endsAt E fim > startsAt (limites que só se
    // tocam não contam — mesma regra do ConflictDetectionService).
    const rows = await prisma.indisponibilidade.findMany({
      where: {
        membroId: memberId,
        inicio: { lt: endsAt },
        fim: { gt: startsAt },
      },
      orderBy: { inicio: 'asc' },
    });
    return rows.map(PrismaUnavailabilityRepository.toEntity);
  }

  async save(unavailability: Unavailability): Promise<Unavailability> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.indisponibilidade.create({
      data: {
        id: unavailability.id,
        membroId: unavailability.memberId,
        inicio: unavailability.startsAt,
        fim: unavailability.endsAt,
        motivo: unavailability.reason,
        criadoEm: unavailability.createdAt,
      },
    });
    return PrismaUnavailabilityRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.indisponibilidade.delete({ where: { id } });
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: IndisponibilidadeRow): Unavailability {
    return Unavailability.restore({
      id: row.id,
      memberId: row.membroId,
      startsAt: row.inicio,
      endsAt: row.fim,
      reason: row.motivo,
      createdAt: row.criadoEm,
    });
  }
}
