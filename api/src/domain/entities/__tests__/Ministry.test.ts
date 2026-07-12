import { Ministry } from '../Ministry';

const base = { institutionId: 'i1', name: 'Louvor' };

describe('Ministry.create', () => {
  it('cria um ministério válido', () => {
    const ministry = Ministry.create({ ...base, description: 'Equipe de música' });

    expect(ministry.id).toBeTruthy();
    expect(ministry.name).toBe('Louvor');
    expect(ministry.description).toBe('Equipe de música');
    expect(ministry.institutionId).toBe('i1');
  });

  it('normaliza nome (trim) e descrição em branco vira null', () => {
    expect(Ministry.create({ ...base, name: '  Louvor  ' }).name).toBe('Louvor');
    expect(Ministry.create({ ...base, description: '   ' }).description).toBeNull();
    expect(Ministry.create(base).description).toBeNull(); // ausente → null
  });

  it('rejeita instituição ausente', () => {
    expect(() => Ministry.create({ ...base, institutionId: '' })).toThrow('Instituição é obrigatória');
  });

  it('rejeita nome vazio ou não-string', () => {
    expect(() => Ministry.create({ ...base, name: '   ' })).toThrow('Nome é obrigatório');
    expect(() => Ministry.create({ ...base, name: 42 as unknown as string })).toThrow('Nome é obrigatório');
  });

  it('rejeita descrição não-string', () => {
    expect(() =>
      Ministry.create({ ...base, description: 99 as unknown as string }),
    ).toThrow('Descrição inválida');
  });
});

describe('Ministry.update', () => {
  it('atualiza nome e descrição; description null limpa a descrição', () => {
    const ministry = Ministry.create({ ...base, description: 'Antiga' });
    const updated = ministry.update({ name: 'Louvor e Adoração', description: null });

    expect(updated.name).toBe('Louvor e Adoração');
    expect(updated.description).toBeNull();
    // imutabilidade
    expect(ministry.name).toBe('Louvor');
    expect(ministry.description).toBe('Antiga');
  });

  it('campos omitidos permanecem inalterados', () => {
    const ministry = Ministry.create({ ...base, description: 'Mantida' });
    const updated = ministry.update({ name: 'Novo Nome' });

    expect(updated.name).toBe('Novo Nome');
    expect(updated.description).toBe('Mantida');
  });

  it('rejeita nome vazio na atualização', () => {
    const ministry = Ministry.create(base);
    expect(() => ministry.update({ name: '  ' })).toThrow('Nome é obrigatório');
  });
});
