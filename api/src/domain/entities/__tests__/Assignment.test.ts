import { Assignment } from '../Assignment';

const base = { scheduleId: 'sc1', memberId: 'mb1', positionId: 'ps1' };

describe('Assignment.create', () => {
  it('cria uma alocação válida com conflict sempre false', () => {
    const assignment = Assignment.create(base);

    expect(assignment.id).toBeTruthy();
    expect(assignment.scheduleId).toBe('sc1');
    expect(assignment.memberId).toBe('mb1');
    expect(assignment.positionId).toBe('ps1');
    expect(assignment.conflict).toBe(false);
    expect(assignment.createdAt).toBeInstanceOf(Date);
  });

  it('rejeita escala ausente ou não-string', () => {
    expect(() => Assignment.create({ ...base, scheduleId: '  ' })).toThrow('Escala é obrigatória');
    expect(() => Assignment.create({ ...base, scheduleId: 1 as unknown as string })).toThrow(
      'Escala é obrigatória',
    );
  });

  it('rejeita membro ausente ou não-string', () => {
    expect(() => Assignment.create({ ...base, memberId: '' })).toThrow('Membro é obrigatório');
    expect(() => Assignment.create({ ...base, memberId: 2 as unknown as string })).toThrow(
      'Membro é obrigatório',
    );
  });

  it('rejeita função ausente ou não-string', () => {
    expect(() => Assignment.create({ ...base, positionId: '   ' })).toThrow('Função é obrigatória');
    expect(() => Assignment.create({ ...base, positionId: 3 as unknown as string })).toThrow(
      'Função é obrigatória',
    );
  });
});

describe('Assignment.restore', () => {
  it('reconstrói a entidade a partir de uma linha persistida (inclusive conflict=true)', () => {
    const createdAt = new Date('2026-07-12T18:00:00Z');
    const assignment = Assignment.restore({
      id: 'a1',
      scheduleId: 'sc1',
      memberId: 'mb1',
      positionId: 'ps1',
      conflict: true,
      createdAt,
    });

    expect(assignment.id).toBe('a1');
    expect(assignment.conflict).toBe(true);
    expect(assignment.createdAt).toEqual(createdAt);
  });
});
