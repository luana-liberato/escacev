import type { Funcao as FuncaoRow } from '@prisma/client';
import { Position } from '../../../domain/entities/Position';
import { PositionRepository } from '../../../domain/repositories/PositionRepository';
import { prisma } from '../prisma';

export class PrismaPositionRepository implements PositionRepository {
  async findById(id: string): Promise<Position | null> {
    const row = await prisma.funcao.findUnique({ where: { id } });
    return row ? PrismaPositionRepository.toEntity(row) : null;
  }

  async findByMinistry(ministryId: string): Promise<Position[]> {
    const rows = await prisma.funcao.findMany({
      where: { ministerioId: ministryId },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaPositionRepository.toEntity);
  }

  async findByNameInMinistry(ministryId: string, name: string): Promise<Position | null> {
    // Sem distinção de maiúsculas: "Vocal" e "vocal" são duplicatas no ministério.
    const row = await prisma.funcao.findFirst({
      where: {
        ministerioId: ministryId,
        nome: { equals: name.trim(), mode: 'insensitive' },
      },
    });
    return row ? PrismaPositionRepository.toEntity(row) : null;
  }

  async save(position: Position): Promise<Position> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.funcao.create({
      data: {
        id: position.id,
        ministerioId: position.ministryId,
        nome: position.name,
        criadoEm: position.createdAt,
      },
    });
    return PrismaPositionRepository.toEntity(row);
  }

  async update(position: Position): Promise<Position> {
    // Só o nome é mutável (ministério não).
    const row = await prisma.funcao.update({
      where: { id: position.id },
      data: { nome: position.name },
    });
    return PrismaPositionRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    // Cascata estrutural: as compatibilidades que referenciam esta função (em
    // qualquer dos lados) são apagadas junto, numa transação — a compatibilidade
    // é estrutura da função, não histórico. As vagas de evento NÃO caem aqui: o
    // use case bloqueia a remoção quando há uso (countEventSlotUsage).
    await prisma.$transaction([
      prisma.compatibilidadeFuncao.deleteMany({
        where: { OR: [{ funcaoAId: id }, { funcaoBId: id }] },
      }),
      prisma.funcao.delete({ where: { id } }),
    ]);
  }

  async countEventSlotUsage(id: string): Promise<number> {
    return prisma.vagaEvento.count({ where: { funcaoId: id } });
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: FuncaoRow): Position {
    return Position.restore({
      id: row.id,
      name: row.nome,
      ministryId: row.ministerioId,
      createdAt: row.criadoEm,
    });
  }
}
