import type { CompatibilidadeFuncao as CompatibilidadeFuncaoRow } from '@prisma/client';
import { PositionCompatibility } from '../../../domain/entities/PositionCompatibility';
import { PositionCompatibilityRepository } from '../../../domain/repositories/PositionCompatibilityRepository';
import { prisma } from '../prisma';

export class PrismaPositionCompatibilityRepository
  implements PositionCompatibilityRepository
{
  async findByPair(
    positionId1: string,
    positionId2: string,
  ): Promise<PositionCompatibility | null> {
    // Forma canônica na fronteira: ordena antes de bater no índice único.
    const [funcaoAId, funcaoBId] = PositionCompatibility.orderPair(positionId1, positionId2);
    const row = await prisma.compatibilidadeFuncao.findUnique({
      where: { funcaoAId_funcaoBId: { funcaoAId, funcaoBId } },
    });
    return row ? PrismaPositionCompatibilityRepository.toEntity(row) : null;
  }

  async save(compatibility: PositionCompatibility): Promise<PositionCompatibility> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.compatibilidadeFuncao.create({
      data: {
        id: compatibility.id,
        funcaoAId: compatibility.positionAId,
        funcaoBId: compatibility.positionBId,
        criadoEm: compatibility.createdAt,
      },
    });
    return PrismaPositionCompatibilityRepository.toEntity(row);
  }

  async delete(positionId1: string, positionId2: string): Promise<boolean> {
    const [funcaoAId, funcaoBId] = PositionCompatibility.orderPair(positionId1, positionId2);
    // deleteMany (e não delete) para não estourar quando o par não existe: o
    // count devolve se algo foi removido e o use case decide a semântica.
    const result = await prisma.compatibilidadeFuncao.deleteMany({
      where: { funcaoAId, funcaoBId },
    });
    return result.count > 0;
  }

  async listByInstitution(institutionId: string): Promise<PositionCompatibility[]> {
    // Escopo por tenant via a função A → ministério → instituição. Como o par é
    // sempre criado com as duas funções da MESMA instituição (garantido no
    // SetPositionCompatibilityUseCase), filtrar pelo lado A já isola o tenant.
    const rows = await prisma.compatibilidadeFuncao.findMany({
      where: { funcaoA: { ministerio: { instituicaoId: institutionId } } },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaPositionCompatibilityRepository.toEntity);
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: CompatibilidadeFuncaoRow): PositionCompatibility {
    return PositionCompatibility.restore({
      id: row.id,
      positionAId: row.funcaoAId,
      positionBId: row.funcaoBId,
      createdAt: row.criadoEm,
    });
  }
}
