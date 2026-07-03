import type { Ministerio as MinisterioRow } from '@prisma/client';
import { Ministry } from '../../../domain/entities/Ministry';
import {
  MinistryBlockingDependencies,
  MinistryRepository,
} from '../../../domain/repositories/MinistryRepository';
import { prisma } from '../prisma';

export class PrismaMinistryRepository implements MinistryRepository {
  async findById(id: string): Promise<Ministry | null> {
    const row = await prisma.ministerio.findUnique({ where: { id } });
    return row ? PrismaMinistryRepository.toEntity(row) : null;
  }

  async findByInstitution(institutionId: string): Promise<Ministry[]> {
    const rows = await prisma.ministerio.findMany({
      where: { instituicaoId: institutionId },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaMinistryRepository.toEntity);
  }

  async findByName(name: string, institutionId: string): Promise<Ministry | null> {
    // Comparação sem distinção de maiúsculas: "Louvor" e "louvor" são duplicatas.
    const row = await prisma.ministerio.findFirst({
      where: {
        instituicaoId: institutionId,
        nome: { equals: name.trim(), mode: 'insensitive' },
      },
    });
    return row ? PrismaMinistryRepository.toEntity(row) : null;
  }

  async save(ministry: Ministry): Promise<Ministry> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.ministerio.create({
      data: {
        id: ministry.id,
        instituicaoId: ministry.institutionId,
        nome: ministry.name,
        descricao: ministry.description,
        criadoEm: ministry.createdAt,
      },
    });
    return PrismaMinistryRepository.toEntity(row);
  }

  async update(ministry: Ministry): Promise<Ministry> {
    // Somente nome e descrição são mutáveis (instituição não).
    const row = await prisma.ministerio.update({
      where: { id: ministry.id },
      data: {
        nome: ministry.name,
        descricao: ministry.description,
      },
    });
    return PrismaMinistryRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    // Cascata estrutural numa única transação: compatibilidades das funções do
    // ministério → funções → vínculos de membros → o próprio ministério.
    await prisma.$transaction([
      prisma.compatibilidadeFuncao.deleteMany({
        where: {
          OR: [{ funcaoA: { ministerioId: id } }, { funcaoB: { ministerioId: id } }],
        },
      }),
      prisma.funcao.deleteMany({ where: { ministerioId: id } }),
      prisma.membroMinisterio.deleteMany({ where: { ministerioId: id } }),
      prisma.ministerio.delete({ where: { id } }),
    ]);
  }

  async countBlockingDependencies(ministryId: string): Promise<MinistryBlockingDependencies> {
    const [schedules, functionsInUse] = await prisma.$transaction([
      prisma.escala.count({ where: { ministerioId: ministryId } }),
      prisma.vagaEvento.count({ where: { funcao: { ministerioId: ministryId } } }),
    ]);
    return { schedules, functionsInUse };
  }

  // Colunas em português (schema.prisma) → entidade em inglês.
  private static toEntity(row: MinisterioRow): Ministry {
    return Ministry.restore({
      id: row.id,
      institutionId: row.instituicaoId,
      name: row.nome,
      description: row.descricao,
      createdAt: row.criadoEm,
    });
  }
}
