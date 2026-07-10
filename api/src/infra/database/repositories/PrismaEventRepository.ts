import type { Evento as EventoRow } from '@prisma/client';
import { Event, EventType } from '../../../domain/entities/Event';
import { EventRepository, EventDateRange } from '../../../domain/repositories/EventRepository';
import { AppError } from '../../../shared/errors/AppError';
import { prisma } from '../prisma';

// Tradução do tipo: domínio em inglês ↔ valor do schema em português.
const TYPE_TO_DB: Record<EventType, string> = {
  SERVICE: 'culto',
  REHEARSAL: 'ensaio',
  SPECIAL: 'especial',
};
const TYPE_FROM_DB: Record<string, EventType> = {
  culto: 'SERVICE',
  ensaio: 'REHEARSAL',
  especial: 'SPECIAL',
};

export class PrismaEventRepository implements EventRepository {
  async findById(id: string): Promise<Event | null> {
    const row = await prisma.evento.findUnique({ where: { id } });
    return row ? PrismaEventRepository.toEntity(row) : null;
  }

  async findByInstitution(institutionId: string, range?: EventDateRange): Promise<Event[]> {
    const rows = await prisma.evento.findMany({
      where: {
        instituicaoId: institutionId,
        // Sobreposição com a janela [from, to]: fim >= from E inicio <= to.
        // Filtros opcionais — sem range, retorna todos os eventos da instituição.
        ...(range?.from ? { fim: { gte: range.from } } : {}),
        ...(range?.to ? { inicio: { lte: range.to } } : {}),
      },
      orderBy: { inicio: 'asc' },
    });
    return rows.map(PrismaEventRepository.toEntity);
  }

  async save(event: Event): Promise<Event> {
    // Entidade em inglês → colunas em português (espelham o schema.prisma).
    const row = await prisma.evento.create({
      data: {
        id: event.id,
        instituicaoId: event.institutionId,
        nome: event.name,
        tipo: TYPE_TO_DB[event.type],
        inicio: event.startsAt,
        fim: event.endsAt,
        criadoEm: event.createdAt,
      },
    });
    return PrismaEventRepository.toEntity(row);
  }

  async update(event: Event): Promise<Event> {
    // Instituição e data de criação não são mutáveis.
    const row = await prisma.evento.update({
      where: { id: event.id },
      data: {
        nome: event.name,
        tipo: TYPE_TO_DB[event.type],
        inicio: event.startsAt,
        fim: event.endsAt,
      },
    });
    return PrismaEventRepository.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.evento.delete({ where: { id } });
  }

  async countSchedules(eventId: string): Promise<number> {
    return prisma.escala.count({ where: { eventoId: eventId } });
  }

  // Coluna em português (schema.prisma) → propriedade em inglês.
  private static toEntity(row: EventoRow): Event {
    return Event.restore({
      id: row.id,
      name: row.nome,
      type: PrismaEventRepository.typeFromDb(row.tipo),
      startsAt: row.inicio,
      endsAt: row.fim,
      institutionId: row.instituicaoId,
      createdAt: row.criadoEm,
    });
  }

  private static typeFromDb(tipo: string): EventType {
    const mapped = TYPE_FROM_DB[tipo];
    // `tipo` é String livre no schema; um valor fora do conjunto é dado
    // inconsistente — falha explícita em vez de devolver algo silencioso.
    if (!mapped) throw new AppError(`Tipo de evento desconhecido no banco: ${tipo}`, 500);
    return mapped;
  }
}
