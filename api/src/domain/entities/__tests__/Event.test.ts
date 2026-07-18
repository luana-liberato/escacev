import { Event } from '../Event';

const d = (s: string) => new Date(s);
const base = {
  name: 'Culto de Domingo',
  type: 'SERVICE',
  startsAt: d('2026-07-12T18:00:00Z'),
  endsAt: d('2026-07-12T20:00:00Z'),
  institutionId: 'i1',
};

describe('Event.create', () => {
  it('cria um evento válido', () => {
    const event = Event.create(base);

    expect(event.id).toBeTruthy();
    expect(event.name).toBe('Culto de Domingo');
    expect(event.type).toBe('SERVICE');
    expect(event.startsAt).toEqual(base.startsAt);
    expect(event.endsAt).toEqual(base.endsAt);
    expect(event.institutionId).toBe('i1');
  });

  it('normaliza o nome (trim)', () => {
    expect(Event.create({ ...base, name: '  Culto  ' }).name).toBe('Culto');
  });

  it('aceita todos os tipos válidos', () => {
    expect(Event.create({ ...base, type: 'REHEARSAL' }).type).toBe('REHEARSAL');
    expect(Event.create({ ...base, type: 'SPECIAL' }).type).toBe('SPECIAL');
    expect(Event.create({ ...base, type: 'MEETING' }).type).toBe('MEETING');
    expect(Event.create({ ...base, type: 'COFFEE' }).type).toBe('COFFEE');
    expect(Event.create({ ...base, type: 'CONFERENCE' }).type).toBe('CONFERENCE');
  });

  it('rejeita instituição ausente', () => {
    expect(() => Event.create({ ...base, institutionId: '  ' })).toThrow('Instituição é obrigatória');
  });

  it('rejeita nome vazio ou não-string', () => {
    expect(() => Event.create({ ...base, name: '   ' })).toThrow('Nome é obrigatório');
    expect(() => Event.create({ ...base, name: 5 as unknown as string })).toThrow('Nome é obrigatório');
  });

  it('rejeita tipo fora do enum', () => {
    expect(() => Event.create({ ...base, type: 'PARTY' })).toThrow('Tipo de evento inválido');
  });

  it('rejeita datas inválidas (NaN)', () => {
    expect(() => Event.create({ ...base, startsAt: new Date('data-invalida') })).toThrow(
      'Data de início inválida',
    );
    expect(() => Event.create({ ...base, endsAt: new Date('data-invalida') })).toThrow(
      'Data de término inválida',
    );
  });

  it('rejeita término anterior ou igual ao início', () => {
    expect(() =>
      Event.create({ ...base, startsAt: d('2026-07-12T20:00:00Z'), endsAt: d('2026-07-12T18:00:00Z') }),
    ).toThrow('depois do início');
    expect(() =>
      Event.create({ ...base, startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T18:00:00Z') }),
    ).toThrow('depois do início');
  });
});

describe('Event.update', () => {
  it('atualiza campos sem mutar a original; instituição permanece imutável', () => {
    const event = Event.create(base);
    const updated = event.update({ name: 'Culto Especial', type: 'SPECIAL' });

    expect(updated.name).toBe('Culto Especial');
    expect(updated.type).toBe('SPECIAL');
    expect(updated.institutionId).toBe('i1');
    // imutabilidade: a original não muda
    expect(event.name).toBe('Culto de Domingo');
    expect(event.type).toBe('SERVICE');
  });

  it('revalida o intervalo ao mudar só um dos limites', () => {
    const event = Event.create(base);
    // mudar só o fim para antes do início existente deve falhar
    expect(() => event.update({ endsAt: d('2026-07-12T17:00:00Z') })).toThrow('depois do início');
  });
});
