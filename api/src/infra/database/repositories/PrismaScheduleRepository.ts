import type { Escala as EscalaRow } from '@prisma/client';
import { Schedule } from '../../../domain/entities/Schedule';
import { ScheduleRepository } from '../../../domain/repositories/ScheduleRepository';
import { prisma } from '../prisma';

export class PrismaScheduleRepository implements ScheduleRepository {
  async findById(id: string): Promise<Schedule | null> {
    const row = await prisma.escala.findUnique({ where: { id } });
    return row ? PrismaScheduleRepository.toEntity(row) : null;
  }

  async findByMinistryEventAndName(
    ministryId: string,
    eventId: string,
    name: string,
  ): Promise<Schedule | null> {
    // Duplicata é case-insensitive (como em Ministerio/Funcao): "6 e 7" e "6 E 7"
    // são a mesma escala. Por isso findFirst com mode 'insensitive' em vez do
    // findUnique exato — o @@unique do banco continua como backstop de corrida.
    const row = await prisma.escala.findFirst({
      where: {
        ministerioId: ministryId,
        eventoId: eventId,
        nome: { equals: name, mode: 'insensitive' },
      },
    });
    return row ? PrismaScheduleRepository.toEntity(row) : null;
  }

  async findByMinistryAndEvent(ministryId: string, eventId: string): Promise<Schedule[]> {
    const rows = await prisma.escala.findMany({
      where: { ministerioId: ministryId, eventoId: eventId },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaScheduleRepository.toEntity);
  }

  async findByEvent(eventId: string, institutionId: string): Promise<Schedule[]> {
    // Tenant via relação: a Escala não tem instituicaoId; filtra pelo ministério.
    const rows = await prisma.escala.findMany({
      where: { eventoId: eventId, ministerio: { instituicaoId: institutionId } },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaScheduleRepository.toEntity);
  }

  async findByMinistry(ministryId: string, institutionId: string): Promise<Schedule[]> {
    const rows = await prisma.escala.findMany({
      where: { ministerioId: ministryId, ministerio: { instituicaoId: institutionId } },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaScheduleRepository.toEntity);
  }

  async findByInstitution(institutionId: string): Promise<Schedule[]> {
    const rows = await prisma.escala.findMany({
      where: { ministerio: { instituicaoId: institutionId } },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(PrismaScheduleRepository.toEntity);
  }

  async save(schedule: Schedule): Promise<Schedule> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.escala.create({
      data: {
        id: schedule.id,
        ministerioId: schedule.ministryId,
        eventoId: schedule.eventId,
        nome: schedule.name,
        status: schedule.status,
        publicadaEm: schedule.publishedAt,
        criadoEm: schedule.createdAt,
      },
    });
    return PrismaScheduleRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.escala.delete({ where: { id } });
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: EscalaRow): Schedule {
    return Schedule.restore({
      id: row.id,
      ministryId: row.ministerioId,
      eventId: row.eventoId,
      name: row.nome,
      status: row.status,
      publishedAt: row.publicadaEm,
      createdAt: row.criadoEm,
    });
  }
}
