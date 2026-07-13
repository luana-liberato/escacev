import { Assignment } from '../Assignment';

const base = { scheduleId: 'sc1', memberId: 'mb1', positionId: 'ps1' };

describe('Assignment.create', () => {
  it('cria uma alocação válida com conflict false por padrão (omitido)', () => {
    const assignment = Assignment.create(base);

    expect(assignment.id).toBeTruthy();
    expect(assignment.scheduleId).toBe('sc1');
    expect(assignment.memberId).toBe('mb1');
    expect(assignment.positionId).toBe('ps1');
    expect(assignment.conflict).toBe(false);
    expect(assignment.createdAt).toBeInstanceOf(Date);
  });

  it('aceita conflict=true explícito (confirmação ciente de conflito, RN03)', () => {
    expect(Assignment.create({ ...base, conflict: true }).conflict).toBe(true);
  });

  it('conflict=false explícito continua false', () => {
    expect(Assignment.create({ ...base, conflict: false }).conflict).toBe(false);
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

describe('Assignment.update', () => {
  it('troca memberId e/ou positionId sem mutar a original; scheduleId/conflict/createdAt imutáveis', () => {
    const assignment = Assignment.create(base);

    const onlyMember = assignment.update({ memberId: 'mb2' });
    expect(onlyMember.memberId).toBe('mb2');
    expect(onlyMember.positionId).toBe('ps1'); // mantido
    expect(onlyMember.scheduleId).toBe(assignment.scheduleId);
    expect(onlyMember.id).toBe(assignment.id);
    expect(onlyMember.createdAt).toBe(assignment.createdAt);

    const both = assignment.update({ memberId: 'mb2', positionId: 'ps2' });
    expect(both.memberId).toBe('mb2');
    expect(both.positionId).toBe('ps2');

    // imutabilidade: a original não muda
    expect(assignment.memberId).toBe('mb1');
    expect(assignment.positionId).toBe('ps1');
  });

  it('campos omitidos permanecem inalterados', () => {
    const assignment = Assignment.create(base);
    const updated = assignment.update({});

    expect(updated.memberId).toBe('mb1');
    expect(updated.positionId).toBe('ps1');
  });

  it('rejeita memberId/positionId vazios quando informados', () => {
    const assignment = Assignment.create(base);
    expect(() => assignment.update({ memberId: '  ' })).toThrow('Membro é obrigatório');
    expect(() => assignment.update({ positionId: '' })).toThrow('Função é obrigatória');
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
