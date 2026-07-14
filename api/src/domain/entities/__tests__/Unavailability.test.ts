import { Unavailability } from '../Unavailability';

const d = (s: string) => new Date(s);
const base = {
  memberId: 'm1',
  startsAt: d('2026-07-12T18:00:00Z'),
  endsAt: d('2026-07-12T22:00:00Z'),
  reason: 'Viagem',
};

describe('Unavailability.create', () => {
  it('cria uma indisponibilidade válida', () => {
    const u = Unavailability.create(base);

    expect(u.id).toBeTruthy();
    expect(u.memberId).toBe('m1');
    expect(u.startsAt).toEqual(base.startsAt);
    expect(u.endsAt).toEqual(base.endsAt);
    expect(u.reason).toBe('Viagem');
    expect(u.createdAt).toBeInstanceOf(Date);
  });

  it('normaliza o motivo (trim)', () => {
    expect(Unavailability.create({ ...base, reason: '  Viagem  ' }).reason).toBe('Viagem');
  });

  it('motivo ausente, nulo ou vazio vira null', () => {
    expect(Unavailability.create({ ...base, reason: undefined }).reason).toBeNull();
    expect(Unavailability.create({ ...base, reason: null }).reason).toBeNull();
    expect(Unavailability.create({ ...base, reason: '   ' }).reason).toBeNull();
  });

  it('rejeita motivo não-string', () => {
    expect(() => Unavailability.create({ ...base, reason: 5 as unknown as string })).toThrow(
      'Motivo inválido',
    );
  });

  it('rejeita membro ausente', () => {
    expect(() => Unavailability.create({ ...base, memberId: '  ' })).toThrow('Membro é obrigatório');
  });

  it('rejeita datas inválidas (NaN)', () => {
    expect(() => Unavailability.create({ ...base, startsAt: new Date('data-invalida') })).toThrow(
      'Data de início inválida',
    );
    expect(() => Unavailability.create({ ...base, endsAt: new Date('data-invalida') })).toThrow(
      'Data de término inválida',
    );
  });

  it('rejeita término anterior ou igual ao início', () => {
    expect(() =>
      Unavailability.create({ ...base, startsAt: d('2026-07-12T22:00:00Z'), endsAt: d('2026-07-12T18:00:00Z') }),
    ).toThrow('depois do início');
    expect(() =>
      Unavailability.create({ ...base, startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T18:00:00Z') }),
    ).toThrow('depois do início');
  });
});
