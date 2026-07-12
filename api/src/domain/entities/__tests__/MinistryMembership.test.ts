import { MinistryMembership } from '../MinistryMembership';

const base = { memberId: 'mb1', ministryId: 'min1' };

describe('MinistryMembership.create', () => {
  it('cria um vínculo válido com isAdmin=false por padrão (só participa)', () => {
    const membership = MinistryMembership.create(base);

    expect(membership.id).toBeTruthy();
    expect(membership.memberId).toBe('mb1');
    expect(membership.ministryId).toBe('min1');
    expect(membership.isAdmin).toBe(false);
  });

  it('aceita isAdmin=true explícito (participa e administra)', () => {
    expect(MinistryMembership.create({ ...base, isAdmin: true }).isAdmin).toBe(true);
  });

  it('rejeita membro ausente', () => {
    expect(() => MinistryMembership.create({ ...base, memberId: '  ' })).toThrow(
      'Membro é obrigatório',
    );
  });

  it('rejeita ministério ausente', () => {
    expect(() => MinistryMembership.create({ ...base, ministryId: '' })).toThrow('Ministério é obrigatório');
  });
});

describe('MinistryMembership.setAdmin', () => {
  it('promove sem mutar a original', () => {
    const membership = MinistryMembership.create(base);
    const promoted = membership.setAdmin(true);

    expect(promoted.isAdmin).toBe(true);
    expect(membership.isAdmin).toBe(false);
    // mantém identidade do vínculo
    expect(promoted.id).toBe(membership.id);
    expect(promoted.memberId).toBe(membership.memberId);
  });

  it('rebaixa um admin existente', () => {
    const membership = MinistryMembership.create({ ...base, isAdmin: true });
    expect(membership.setAdmin(false).isAdmin).toBe(false);
  });
});
