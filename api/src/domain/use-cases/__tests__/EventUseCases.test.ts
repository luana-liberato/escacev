import { Event } from '../../entities/Event';
import { EventRepository, EventDateRange } from '../../repositories/EventRepository';
import { CreateEventUseCase } from '../CreateEventUseCase';
import { ListEventsUseCase } from '../ListEventsUseCase';
import { GetEventUseCase } from '../GetEventUseCase';
import { UpdateEventUseCase } from '../UpdateEventUseCase';
import { DeleteEventUseCase } from '../DeleteEventUseCase';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Fake em memória do EventRepository — não toca o banco. Cobre entidade e
 * orquestração dos use cases isoladamente (nível unitário).
 */
class FakeEventRepository implements EventRepository {
  events: Event[] = [];
  schedules: Record<string, number> = {};

  async findById(id: string): Promise<Event | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }

  async findByInstitution(institutionId: string, range?: EventDateRange): Promise<Event[]> {
    return this.events
      .filter((e) => e.institutionId === institutionId)
      .filter((e) => (range?.from ? e.endsAt >= range.from : true))
      .filter((e) => (range?.to ? e.startsAt <= range.to : true))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async save(event: Event): Promise<Event> {
    this.events.push(event);
    return event;
  }

  async update(event: Event): Promise<Event> {
    this.events = this.events.map((e) => (e.id === event.id ? event : e));
    return event;
  }

  async delete(id: string): Promise<void> {
    this.events = this.events.filter((e) => e.id !== id);
  }

  async countSchedules(eventId: string): Promise<number> {
    return this.schedules[eventId] ?? 0;
  }
}

const d = (s: string) => new Date(s);

describe('CreateEventUseCase', () => {
  it('cria um evento válido', async () => {
    const repo = new FakeEventRepository();
    const useCase = new CreateEventUseCase(repo);

    const event = await useCase.execute({
      institutionId: 'i1',
      name: 'Culto Domingo',
      type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'),
      endsAt: d('2026-07-12T20:00:00Z'),
    });

    expect(event.id).toBeTruthy();
    expect(event.name).toBe('Culto Domingo');
    expect(event.type).toBe('SERVICE');
    expect(repo.events).toHaveLength(1);
  });

  it('rejeita quando endsAt <= startsAt', async () => {
    const repo = new FakeEventRepository();
    const useCase = new CreateEventUseCase(repo);

    await expect(
      useCase.execute({
        institutionId: 'i1',
        name: 'Culto Domingo',
        type: 'SERVICE',
        startsAt: d('2026-07-12T20:00:00Z'),
        endsAt: d('2026-07-12T18:00:00Z'), // fim antes do início
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('depois do início') });

    await expect(
      useCase.execute({
        institutionId: 'i1',
        name: 'Culto Domingo',
        type: 'SERVICE',
        startsAt: d('2026-07-12T18:00:00Z'),
        endsAt: d('2026-07-12T18:00:00Z'), // igual
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(repo.events).toHaveLength(0);
  });
});

describe('ListEventsUseCase', () => {
  it('filtra por período (sobreposição com a janela)', async () => {
    const repo = new FakeEventRepository();
    const createUC = new CreateEventUseCase(repo);
    const listUC = new ListEventsUseCase(repo);

    const julho = await createUC.execute({
      institutionId: 'i1', name: 'Culto Julho', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });
    const viraMes = await createUC.execute({
      institutionId: 'i1', name: 'Vira-mês', type: 'SPECIAL',
      startsAt: d('2026-07-31T22:00:00Z'), endsAt: d('2026-08-01T01:00:00Z'),
    });
    await createUC.execute({
      institutionId: 'i1', name: 'Ensaio Agosto', type: 'REHEARSAL',
      startsAt: d('2026-08-05T19:00:00Z'), endsAt: d('2026-08-05T21:00:00Z'),
    });

    const emJulho = await listUC.execute({
      institutionId: 'i1', from: d('2026-07-01T00:00:00Z'), to: d('2026-07-31T23:59:59Z'),
    });

    expect(emJulho.map((e) => e.id).sort()).toEqual([julho.id, viraMes.id].sort());
  });

  it('sem filtro retorna todos os eventos da instituição, ordenados por início', async () => {
    const repo = new FakeEventRepository();
    const createUC = new CreateEventUseCase(repo);
    const listUC = new ListEventsUseCase(repo);

    await createUC.execute({
      institutionId: 'i1', name: 'B', type: 'SERVICE',
      startsAt: d('2026-08-01T10:00:00Z'), endsAt: d('2026-08-01T11:00:00Z'),
    });
    await createUC.execute({
      institutionId: 'i1', name: 'A', type: 'SERVICE',
      startsAt: d('2026-07-01T10:00:00Z'), endsAt: d('2026-07-01T11:00:00Z'),
    });
    await createUC.execute({ institutionId: 'i2', name: 'Outra instituição', type: 'SERVICE',
      startsAt: d('2026-07-01T10:00:00Z'), endsAt: d('2026-07-01T11:00:00Z') });

    const all = await listUC.execute({ institutionId: 'i1' });

    expect(all.map((e) => e.name)).toEqual(['A', 'B']); // ordem cronológica
  });
});

describe('GetEventUseCase', () => {
  it('404 quando o evento é de outra instituição', async () => {
    const repo = new FakeEventRepository();
    const createUC = new CreateEventUseCase(repo);
    const getUC = new GetEventUseCase(repo);

    const event = await createUC.execute({
      institutionId: 'i1', name: 'Culto', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });

    await expect(getUC.execute({ institutionId: 'i2', id: event.id }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UpdateEventUseCase', () => {
  it('revalida o intervalo ao mudar só um dos limites', async () => {
    const repo = new FakeEventRepository();
    const createUC = new CreateEventUseCase(repo);
    const updateUC = new UpdateEventUseCase(repo);

    const event = await createUC.execute({
      institutionId: 'i1', name: 'Culto', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });

    await expect(
      updateUC.execute({ institutionId: 'i1', id: event.id, endsAt: d('2026-07-12T17:00:00Z') }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('DeleteEventUseCase', () => {
  it('bloqueia com 409 quando há escala vinculada', async () => {
    const repo = new FakeEventRepository();
    const createUC = new CreateEventUseCase(repo);
    const deleteUC = new DeleteEventUseCase(repo);

    const event = await createUC.execute({
      institutionId: 'i1', name: 'Culto', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });
    repo.schedules[event.id] = 2;

    await expect(deleteUC.execute({ institutionId: 'i1', id: event.id }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('escalas vinculadas') });

    expect(repo.events).toHaveLength(1); // não removeu
  });

  it('remove quando não há escala vinculada', async () => {
    const repo = new FakeEventRepository();
    const createUC = new CreateEventUseCase(repo);
    const deleteUC = new DeleteEventUseCase(repo);

    const event = await createUC.execute({
      institutionId: 'i1', name: 'Culto', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });

    await deleteUC.execute({ institutionId: 'i1', id: event.id });

    expect(repo.events).toHaveLength(0);
  });
});
