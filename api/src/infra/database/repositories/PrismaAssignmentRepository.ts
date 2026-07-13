import type { Alocacao as AlocacaoRow, Membro as MembroRow, Funcao as FuncaoRow } from '@prisma/client';
import { Assignment } from '../../../domain/entities/Assignment';
import { Member } from '../../../domain/entities/Member';
import { Position } from '../../../domain/entities/Position';
import {
  AssignmentDetail,
  AssignmentRepository,
  MemberAssignmentContext,
} from '../../../domain/repositories/AssignmentRepository';
import { prisma } from '../prisma';

export class PrismaAssignmentRepository implements AssignmentRepository {
  async findById(id: string): Promise<Assignment | null> {
    const row = await prisma.alocacao.findUnique({ where: { id } });
    return row ? PrismaAssignmentRepository.toEntity(row) : null;
  }

  async findByScheduleWithDetails(scheduleId: string): Promise<AssignmentDetail[]> {
    // Uma única consulta com join (evita N+1 de buscar membro/função por alocação).
    const rows = await prisma.alocacao.findMany({
      where: { escalaId: scheduleId },
      include: { membro: true, funcao: true },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map((row) => ({
      assignment: PrismaAssignmentRepository.toEntity(row),
      member: PrismaAssignmentRepository.memberToEntity(row.membro),
      position: PrismaAssignmentRepository.positionToEntity(row.funcao),
    }));
  }

  async findByMemberWithContext(memberId: string): Promise<MemberAssignmentContext[]> {
    // Uma única consulta com join (evita N+1): Alocacao -> Escala -> Evento.
    const rows = await prisma.alocacao.findMany({
      where: { membroId: memberId },
      include: { escala: { include: { evento: true } } },
    });
    return rows.map((row) => ({
      assignmentId: row.id,
      scheduleId: row.escalaId,
      ministryId: row.escala.ministerioId,
      eventId: row.escala.eventoId,
      eventName: row.escala.evento.nome,
      positionId: row.funcaoId,
      startsAt: row.escala.evento.inicio,
      endsAt: row.escala.evento.fim,
    }));
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
    // Escala não é mutável por aqui. conflict É persistido: o
    // UpdateAssignmentUseCase recalcula a flag a cada edição (RN01/RN03) e
    // espera que o valor recalculado seja gravado, não apenas retornado.
    const row = await prisma.alocacao.update({
      where: { id: assignment.id },
      data: {
        membroId: assignment.memberId,
        funcaoId: assignment.positionId,
        conflito: assignment.conflict,
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

  // Réplica do mapeamento de PrismaMemberRepository — só o necessário para o join.
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

  // Réplica do mapeamento de PrismaPositionRepository — só o necessário para o join.
  private static positionToEntity(row: FuncaoRow): Position {
    return Position.restore({
      id: row.id,
      name: row.nome,
      ministryId: row.ministerioId,
      createdAt: row.criadoEm,
    });
  }
}
