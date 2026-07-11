import { PositionCompatibility } from '../PositionCompatibility';
import { AppError } from '../../../shared/errors/AppError';

describe('PositionCompatibility.create', () => {
  it('guarda o par na forma canônica (menor id = A, maior id = B)', () => {
    const compat = PositionCompatibility.create({ positionAId: 'fzz', positionBId: 'faa' });

    expect(compat.positionAId).toBe('faa');
    expect(compat.positionBId).toBe('fzz');
    expect(compat.id).toBeTruthy();
  });

  it('produz o mesmo par independentemente da ordem dos argumentos (relação simétrica)', () => {
    const ab = PositionCompatibility.create({ positionAId: 'fa', positionBId: 'fb' });
    const ba = PositionCompatibility.create({ positionAId: 'fb', positionBId: 'fa' });

    expect(ab.positionAId).toBe(ba.positionAId);
    expect(ab.positionBId).toBe(ba.positionBId);
  });

  it('rejeita função compatível consigo mesma (ids iguais)', () => {
    expect(() => PositionCompatibility.create({ positionAId: 'fx', positionBId: 'fx' })).toThrow(
      'consigo mesma',
    );
  });

  it('rejeita ids vazios ou não-string', () => {
    expect(() => PositionCompatibility.create({ positionAId: 'fa', positionBId: '  ' })).toThrow(
      AppError,
    );
    expect(() =>
      PositionCompatibility.create({ positionAId: 1 as unknown as string, positionBId: 'fb' }),
    ).toThrow('duas funções válidas');
  });
});

describe('PositionCompatibility.orderPair', () => {
  it('ordena qualquer par em ordem crescente (função pura, não valida)', () => {
    expect(PositionCompatibility.orderPair('b', 'a')).toEqual(['a', 'b']);
    expect(PositionCompatibility.orderPair('a', 'b')).toEqual(['a', 'b']);
    // não lança para ids iguais — a validação de par mora em create()
    expect(PositionCompatibility.orderPair('x', 'x')).toEqual(['x', 'x']);
  });
});
