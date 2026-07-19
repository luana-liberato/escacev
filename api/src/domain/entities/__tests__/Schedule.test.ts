import { Schedule } from '../Schedule';

const base = { ministryId: 'min1', eventId: 'ev1' };

describe('Schedule.create', () => {
  it('cria a escala vazia: status RASCUNHO, publishedAt null e nome "" por padrão', () => {
    const schedule = Schedule.create(base);

    expect(schedule.id).toBeTruthy();
    expect(schedule.ministryId).toBe('min1');
    expect(schedule.eventId).toBe('ev1');
    expect(schedule.name).toBe(''); // sem rótulo → escala única do ministério
    expect(schedule.status).toBe('RASCUNHO');
    expect(schedule.publishedAt).toBeNull();
    expect(schedule.createdAt).toBeInstanceOf(Date);
  });

  it('aceita um rótulo (nome) e o normaliza (trim)', () => {
    expect(Schedule.create({ ...base, name: '  Sala 1  ' }).name).toBe('Sala 1');
    expect(Schedule.create({ ...base, name: '   ' }).name).toBe(''); // branco → ""
  });

  it('date é null por padrão, aceita um dia e o preserva ao publicar', () => {
    expect(Schedule.create(base).date).toBeNull();
    const dia = new Date('2026-07-21T00:00:00Z');
    const schedule = Schedule.create({ ...base, date: dia });
    expect(schedule.date).toEqual(dia);
    expect(schedule.publish().date).toEqual(dia); // dia preservado na publicação
  });

  it('rejeita nome não-string', () => {
    expect(() => Schedule.create({ ...base, name: 5 as unknown as string })).toThrow(
      'Nome da escala inválido',
    );
  });

  it('rejeita ministério ausente ou não-string', () => {
    expect(() => Schedule.create({ ...base, ministryId: '  ' })).toThrow('Ministério é obrigatório');
    expect(() => Schedule.create({ ...base, ministryId: 1 as unknown as string })).toThrow(
      'Ministério é obrigatório',
    );
  });

  it('rejeita evento ausente ou não-string', () => {
    expect(() => Schedule.create({ ...base, eventId: '' })).toThrow('Evento é obrigatório');
    expect(() => Schedule.create({ ...base, eventId: 2 as unknown as string })).toThrow(
      'Evento é obrigatório',
    );
  });
});

describe('Schedule.publish', () => {
  it('transita RASCUNHO → PUBLICADA e carimba publishedAt', () => {
    const draft = Schedule.create({ ...base, name: 'Sala 1' });
    const published = draft.publish();

    expect(published.status).toBe('PUBLICADA');
    expect(published.publishedAt).toBeInstanceOf(Date);
    // Identidade preservada (id, trio, createdAt).
    expect(published.id).toBe(draft.id);
    expect(published.ministryId).toBe(draft.ministryId);
    expect(published.eventId).toBe(draft.eventId);
    expect(published.name).toBe(draft.name);
    expect(published.createdAt).toEqual(draft.createdAt);
  });

  it('é imutável: não muta a instância original', () => {
    const draft = Schedule.create(base);
    draft.publish();

    expect(draft.status).toBe('RASCUNHO');
    expect(draft.publishedAt).toBeNull();
  });

  it('bloqueia republicar uma escala já PUBLICADA (409) — preserva publicadaEm (RN07)', () => {
    const published = Schedule.restore({
      id: 's1',
      ministryId: 'min1',
      eventId: 'ev1',
      name: '',
      date: null,
      status: 'PUBLICADA',
      publishedAt: new Date('2026-07-10T12:00:00Z'),
      createdAt: new Date('2026-07-01T09:00:00Z'),
    });

    expect(() => published.publish()).toThrow('Escala já está publicada');
    let caught: unknown;
    try {
      published.publish();
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ statusCode: 409 });
  });
});

describe('Schedule.restore', () => {
  it('reconstrói a entidade a partir de uma linha persistida (inclusive PUBLICADA)', () => {
    const publishedAt = new Date('2026-07-10T12:00:00Z');
    const createdAt = new Date('2026-07-01T09:00:00Z');
    const schedule = Schedule.restore({
      id: 's1',
      ministryId: 'min1',
      eventId: 'ev1',
      name: 'Sala 1',
      date: null,
      status: 'PUBLICADA',
      publishedAt,
      createdAt,
    });

    expect(schedule.id).toBe('s1');
    expect(schedule.name).toBe('Sala 1');
    expect(schedule.status).toBe('PUBLICADA');
    expect(schedule.publishedAt).toEqual(publishedAt);
    expect(schedule.createdAt).toEqual(createdAt);
  });
});
