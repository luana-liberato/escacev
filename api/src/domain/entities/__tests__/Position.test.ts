import { Position } from '../Position';

const base = { name: 'Baterista', ministryId: 'min1' };

describe('Position.create', () => {
  it('cria uma função válida', () => {
    const position = Position.create(base);

    expect(position.id).toBeTruthy();
    expect(position.name).toBe('Baterista');
    expect(position.ministryId).toBe('min1');
  });

  it('normaliza o nome (trim)', () => {
    expect(Position.create({ ...base, name: '  Vocal  ' }).name).toBe('Vocal');
  });

  it('rejeita ministério ausente', () => {
    expect(() => Position.create({ ...base, ministryId: '' })).toThrow('Ministério é obrigatório');
  });

  it('rejeita nome vazio ou não-string', () => {
    expect(() => Position.create({ ...base, name: '   ' })).toThrow('Nome é obrigatório');
    expect(() => Position.create({ ...base, name: 7 as unknown as string })).toThrow('Nome é obrigatório');
  });
});

describe('Position.update', () => {
  it('atualiza o nome sem mutar a original; ministério permanece imutável', () => {
    const position = Position.create(base);
    const updated = position.update({ name: 'Percussionista' });

    expect(updated.name).toBe('Percussionista');
    expect(updated.ministryId).toBe('min1');
    expect(position.name).toBe('Baterista');
  });

  it('rejeita nome vazio na atualização', () => {
    const position = Position.create(base);
    expect(() => position.update({ name: '  ' })).toThrow('Nome é obrigatório');
  });
});
