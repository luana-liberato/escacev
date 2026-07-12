import { Account } from '../Account';

const base = { googleSub: 'google-123', email: 'user@example.com' };

describe('Account.create', () => {
  it('cria uma conta válida a partir do perfil do Google', () => {
    const account = Account.create({
      ...base,
      displayName: 'Fulano',
      photoUrl: 'https://example.com/foto.png',
    });

    expect(account.id).toBeTruthy();
    expect(account.googleSub).toBe('google-123');
    expect(account.email).toBe('user@example.com');
    expect(account.displayName).toBe('Fulano');
    expect(account.photoUrl).toBe('https://example.com/foto.png');
  });

  it('normaliza googleSub (trim) e e-mail (trim + lowercase)', () => {
    const account = Account.create({ googleSub: '  google-123  ', email: '  USER@Example.COM ' });

    expect(account.googleSub).toBe('google-123');
    expect(account.email).toBe('user@example.com');
  });

  it('displayName e photoUrl em branco viram null (campos opcionais)', () => {
    const account = Account.create({ ...base, displayName: '  ', photoUrl: '' });

    expect(account.displayName).toBeNull();
    expect(account.photoUrl).toBeNull();
  });

  it('rejeita googleSub ausente', () => {
    expect(() => Account.create({ ...base, googleSub: '  ' })).toThrow('googleSub é obrigatório');
  });

  it('rejeita e-mail ausente', () => {
    expect(() => Account.create({ ...base, email: '' })).toThrow('E-mail é obrigatório');
  });
});
