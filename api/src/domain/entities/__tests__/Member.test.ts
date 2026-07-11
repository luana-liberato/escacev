import { Member } from '../Member';
import { AppError } from '../../../shared/errors/AppError';

const base = { institutionId: 'i1', name: 'João Silva', email: 'joao@example.com' };

describe('Member.create', () => {
  it('cria um membro válido com perfil padrão MEMBRO e sem accountId (convite pendente)', () => {
    const member = Member.create(base);

    expect(member.id).toBeTruthy();
    expect(member.name).toBe('João Silva');
    expect(member.email).toBe('joao@example.com');
    expect(member.role).toBe('MEMBRO');
    expect(member.institutionId).toBe('i1');
    expect(member.active).toBe(true);
    expect(member.accountId).toBeNull();
    expect(member.isPending).toBe(true);
  });

  it('normaliza nome (trim) e e-mail (trim + lowercase)', () => {
    const member = Member.create({ ...base, name: '  João  ', email: '  JOAO@Example.COM ' });

    expect(member.name).toBe('João');
    expect(member.email).toBe('joao@example.com');
  });

  it('aceita perfil explícito válido', () => {
    expect(Member.create({ ...base, role: 'ADMIN_GERAL' }).role).toBe('ADMIN_GERAL');
  });

  it('rejeita instituição ausente', () => {
    expect(() => Member.create({ ...base, institutionId: '  ' })).toThrow(AppError);
  });

  it('rejeita nome vazio ou não-string', () => {
    expect(() => Member.create({ ...base, name: '   ' })).toThrow('Nome é obrigatório');
    // valor não-string vira 400 tratado, não TypeError → 500
    expect(() => Member.create({ ...base, name: 123 as unknown as string })).toThrow(AppError);
  });

  it('rejeita e-mail em formato inválido', () => {
    expect(() => Member.create({ ...base, email: 'sem-arroba' })).toThrow('E-mail inválido');
  });

  it('rejeita perfil fora do enum', () => {
    expect(() => Member.create({ ...base, role: 'ROOT' as never })).toThrow('Perfil inválido');
  });
});

describe('Member.update', () => {
  it('atualiza nome, perfil e ativo; e-mail e instituição permanecem imutáveis', () => {
    const member = Member.create(base);
    const updated = member.update({ name: 'Novo Nome', role: 'ADMIN_MINISTERIO', active: false });

    expect(updated.name).toBe('Novo Nome');
    expect(updated.role).toBe('ADMIN_MINISTERIO');
    expect(updated.active).toBe(false);
    expect(updated.email).toBe(member.email);
    expect(updated.institutionId).toBe(member.institutionId);
    // imutabilidade: a original não muda
    expect(member.name).toBe('João Silva');
  });

  it('campos omitidos permanecem inalterados', () => {
    const member = Member.create({ ...base, role: 'ADMIN_GERAL' });
    const updated = member.update({ name: 'Só o nome' });

    expect(updated.name).toBe('Só o nome');
    expect(updated.role).toBe('ADMIN_GERAL');
    expect(updated.active).toBe(true);
  });
});

describe('Member.deactivate', () => {
  it('devolve cópia inativa sem mutar a original (soft delete)', () => {
    const member = Member.create(base);
    const inactive = member.deactivate();

    expect(inactive.active).toBe(false);
    expect(member.active).toBe(true);
  });
});
