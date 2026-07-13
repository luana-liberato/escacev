import type { Alocacao as AlocacaoRow } from '@prisma/client';
import { Assignment } from '../../../domain/entities/Assignment';
import { AssignmentRepository } from '../../../domain/repositories/AssignmentRepository';
import { prisma } from '../prisma';

export class PrismaAssignmentRepository implements AssignmentRepository {
  async findById(id: string): Promise<Assignment | null> {
    const row = await prisma.alocacao.findUnique({ where: { id } });
    return row ? PrismaAssignmentRepository.toEntity(row) : null;
  }

  async save(assignment: Assignment): Promise<Assignment> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.alocacao.create({
      data: {
        id: assignment.id,
        escalaId: assignment.scheduleId,
        membroId: assignment.memberId,
        funcaoId: assignment.positionId,
        conflito: assignment.conflict,
        criadoEm: assignment.createdAt,
      },
    });
    return PrismaAssignmentRepository.toEntity(row);
  }

  async update(assignment: Assignment): Promise<Assignment> {
    // Escala e conflict não são mutáveis por aqui (conflict é do motor de conflito).
    const row = await prisma.alocacao.update({
      where: { id: assignment.id },
      data: {
        membroId: assignment.memberId,
        funcaoId: assignment.positionId,
      },
    });
    return PrismaAssignmentRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.alocacao.delete({ where: { id } });
  }

  async existsByScheduleMemberPosition(
    scheduleId: string,
    memberId: string,
    positionId: string,
  ): Promise<boolean> {
    const row = await prisma.alocacao.findUnique({
      where: {
        escalaId_membroId_funcaoId: {
          escalaId: scheduleId,
          membroId: memberId,
          funcaoId: positionId,
        },
      },
    });
    return row !== null;
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: AlocacaoRow): Assignment {
    return Assignment.restore({
      id: row.id,
      scheduleId: row.escalaId,
      memberId: row.membroId,
      positionId: row.funcaoId,
      conflict: row.conflito,
      createdAt: row.criadoEm,
    });
  }
}
