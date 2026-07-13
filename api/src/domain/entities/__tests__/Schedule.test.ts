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

describe('Schedule.restore', () => {
  it('reconstrói a entidade a partir de uma linha persistida (inclusive PUBLICADA)', () => {
    const publishedAt = new Date('2026-07-10T12:00:00Z');
    const createdAt = new Date('2026-07-01T09:00:00Z');
    const schedule = Schedule.restore({
      id: 's1',
      ministryId: 'min1',
      eventId: 'ev1',
      name: 'Sala 1',
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
