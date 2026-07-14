import type { Alocacao as AlocacaoRow, Membro as MembroRow, Funcao as FuncaoRow } from '@prisma/client';
import { Assignment } from '../../../domain/entities/Assignment';
import { Member } from '../../../domain/entities/Member';
import { Position } from '../../../domain/entities/Position';
import {
  AssignmentDetail,
  AssignmentRepository,
  DateRange,
  MemberAssignmentContext,
  MemberScheduleEntry,
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
    // Uma única consulta com join (evita N+1): Alocacao -> Membro/Funcao e
    // Escala -> Evento/Ministerio. Traz os nomes legíveis (incremento 3a)
    // desde a origem, sem consulta adicional por conflito.
    const rows = await prisma.alocacao.findMany({
      where: { membroId: memberId },
      include: {
        membro: true,
        funcao: true,
        escala: { include: { evento: true, ministerio: true } },
      },
    });
    return rows.map((row) => ({
      assignmentId: row.id,
      memberName: row.membro.nome,
      scheduleId: row.escalaId,
      schedulePublishedAt: row.escala.publicadaEm,
      ministryId: row.escala.ministerioId,
      ministryName: row.escala.ministerio.nome,
      eventId: row.escala.eventoId,
      eventName: row.escala.evento.nome,
      positionId: row.funcaoId,
      positionName: row.funcao.nome,
      startsAt: row.escala.evento.inicio,
      endsAt: row.escala.evento.fim,
    }));
  }

  async findByMemberPublishedInRange(
    memberId: string,
    range: DateRange,
  ): Promise<MemberScheduleEntry[]> {
    // Só escalas PUBLICADA (RN04: rascunho invisível ao membro) cujo evento
    // começa no intervalo. Join único (Alocacao -> Funcao e Escala -> Evento/
    // Ministerio). Ordenação por início do evento é feita em memória para não
    // depender de orderBy aninhado em relação (mantém a query simples e portável).
    const rows = await prisma.alocacao.findMany({
      where: {
        membroId: memberId,
        escala: {
          status: 'PUBLICADA',
          evento: { inicio: { gte: range.from, lte: range.to } },
        },
      },
      include: {
        funcao: true,
        escala: { include: { evento: true, ministerio: true } },
      },
    });
    return rows
      .map((row) => ({
        assignmentId: row.id,
        scheduleId: row.escalaId,
        scheduleName: row.escala.nome,
        ministryId: row.escala.ministerioId,
        ministryName: row.escala.ministerio.nome,
        eventId: row.escala.eventoId,
        eventName: row.escala.evento.nome,
        eventType: row.escala.evento.tipo,
        startsAt: row.escala.evento.inicio,
        endsAt: row.escala.evento.fim,
        positionId: row.funcaoId,
        positionName: row.funcao.nome,
      }))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
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
