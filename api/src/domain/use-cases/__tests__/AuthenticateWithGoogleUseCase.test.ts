import { Account } from '../../entities/Account';
import { Member } from '../../entities/Member';
import { AccountRepository } from '../../repositories/AccountRepository';
import { MemberRepository } from '../../repositories/MemberRepository';
import { JwtService } from '../../../infra/services/jwt';
import { AuthenticateWithGoogleUseCase, GoogleProfileDTO } from '../AuthenticateWithGoogleUseCase';

/**
 * Unit do fluxo de login com Google (Seção 5 do CLAUDE.md). Cobre as ramificações
 * de vínculo Conta↔Membro com fakes em memória; usa o JwtService real (mesmo
 * segredo do .env) para conferir os claims do token emitido. Sem banco e sem
 * depender do OAuth do browser — a parte do Passport fica fora do use case.
 */
class FakeAccountRepository implements AccountRepository {
  accounts: Account[] = [];
  saveCount = 0;

  async findByGoogleSub(googleSub: string): Promise<Account | null> {
    return this.accounts.find((a) => a.googleSub === googleSub) ?? null;
  }
  async findByEmail(email: string): Promise<Account | null> {
    return this.accounts.find((a) => a.email === email) ?? null;
  }
  async save(account: Account): Promise<Account> {
    this.saveCount += 1;
    this.accounts.push(account);
    return account;
  }
}

class FakeMemberRepository implements MemberRepository {
  members: Member[] = [];
  linkCount = 0;

  async findById(id: string): Promise<Member | null> {
    return this.members.find((m) => m.id === id) ?? null;
  }
  async findByAccountId(accountId: string): Promise<Member | null> {
    return this.members.find((m) => m.accountId === accountId) ?? null;
  }
  async findByEmailAndInstitution(email: string, institutionId: string): Promise<Member | null> {
    return this.members.find((m) => m.email === email && m.institutionId === institutionId) ?? null;
  }
  async findByInstitution(institutionId: string): Promise<Member[]> {
    return this.members.filter((m) => m.institutionId === institutionId);
  }
  async findPendingByEmail(email: string): Promise<Member | null> {
    return this.members.find((m) => m.email === email && m.accountId === null) ?? null;
  }
  async save(member: Member): Promise<Member> {
    this.members.push(member);
    return member;
  }
  async update(member: Member): Promise<Member> {
    this.members = this.members.map((m) => (m.id === member.id ? member : m));
    return member;
  }
  async linkAccount(memberId: string, accountId: string): Promise<Member> {
    this.linkCount += 1;
    const member = this.members.find((m) => m.id === memberId)!;
    const linked = Member.restore({ ...member, accountId });
    this.members = this.members.map((m) => (m.id === memberId ? linked : m));
    return linked;
  }
}

const jwtService = new JwtService();

const profile: GoogleProfileDTO = {
  googleSub: 'google-sub-123',
  email: 'pessoa@example.com',
  name: 'Pessoa Convidada',
  photoUrl: 'https://example.com/foto.png',
};

/** Cria um convite pendente (Member sem Account) com o e-mail do perfil. */
function pendingInvite(overrides?: Partial<{ role: 'ADMIN_GERAL' | 'MEMBRO' }>): Member {
  return Member.create({
    institutionId: 'inst-1',
    name: 'Pessoa Convidada',
    email: profile.email,
    role: overrides?.role ?? 'MEMBRO',
  });
}

function build() {
  const accountRepo = new FakeAccountRepository();
  const memberRepo = new FakeMemberRepository();
  const useCase = new AuthenticateWithGoogleUseCase(accountRepo, memberRepo, jwtService);
  return { accountRepo, memberRepo, useCase };
}

describe('AuthenticateWithGoogleUseCase', () => {
  it('primeiro login com convite pendente: cria a Conta, vincula ao Membro e emite JWT com os claims certos', async () => {
    const { accountRepo, memberRepo, useCase } = build();
    const invite = pendingInvite({ role: 'ADMIN_GERAL' });
    await memberRepo.save(invite);

    const { token } = await useCase.execute(profile);

    expect(accountRepo.saveCount).toBe(1); // Conta criada
    expect(memberRepo.linkCount).toBe(1); // vínculo feito
    const linked = await memberRepo.findById(invite.id);
    expect(linked?.accountId).toBe(accountRepo.accounts[0].id);

    const claims = jwtService.verify(token);
    expect(claims).toEqual({ memberId: invite.id, institutionId: 'inst-1', role: 'ADMIN_GERAL' });
  });

  it('e-mail não convidado: nega com 403 SEM criar Conta (evita Conta órfã — fix do PR #4)', async () => {
    const { accountRepo, memberRepo, useCase } = build();
    // nenhum convite pendente cadastrado

    await expect(useCase.execute(profile)).rejects.toMatchObject({ statusCode: 403 });
    expect(accountRepo.saveCount).toBe(0); // nada de Conta órfã
    expect(memberRepo.linkCount).toBe(0);
  });

  it('Conta órfã pré-existente (Conta existe, mas nunca vinculada) + convite: vincula sem criar nova Conta', async () => {
    const { accountRepo, memberRepo, useCase } = build();
    // Conta órfã: existe pelo googleSub, mas nenhum Membro aponta para ela.
    const orphan = Account.create({
      googleSub: profile.googleSub,
      email: profile.email,
      displayName: profile.name,
    });
    await accountRepo.save(orphan);
    accountRepo.saveCount = 0; // zera para medir só o efeito do use case
    const invite = pendingInvite();
    await memberRepo.save(invite);

    const { token } = await useCase.execute(profile);

    expect(accountRepo.saveCount).toBe(0); // NÃO cria outra Conta
    expect(memberRepo.linkCount).toBe(1);
    const linked = await memberRepo.findById(invite.id);
    expect(linked?.accountId).toBe(orphan.id);
    expect(jwtService.verify(token).memberId).toBe(invite.id);
  });

  it('fallback por e-mail: Conta existe com outro googleSub, mas mesmo e-mail → reutiliza essa Conta', async () => {
    const { accountRepo, memberRepo, useCase } = build();
    const byEmail = Account.create({
      googleSub: 'outro-sub-diferente',
      email: profile.email,
      displayName: 'Antiga',
    });
    await accountRepo.save(byEmail);
    accountRepo.saveCount = 0;
    const invite = pendingInvite();
    await memberRepo.save(invite);

    await useCase.execute(profile);

    expect(accountRepo.saveCount).toBe(0);
    const linked = await memberRepo.findById(invite.id);
    expect(linked?.accountId).toBe(byEmail.id);
  });

  it('usuário recorrente (Conta já vinculada a um Membro): só emite o JWT, sem criar Conta nem revincular', async () => {
    const { accountRepo, memberRepo, useCase } = build();
    const account = Account.create({ googleSub: profile.googleSub, email: profile.email });
    await accountRepo.save(account);
    accountRepo.saveCount = 0;
    // Membro já vinculado a essa Conta.
    const member = Member.create({
      institutionId: 'inst-1',
      name: 'Recorrente',
      email: profile.email,
      role: 'MEMBRO',
      accountId: account.id,
    });
    await memberRepo.save(member);

    const { token } = await useCase.execute(profile);

    expect(accountRepo.saveCount).toBe(0);
    expect(memberRepo.linkCount).toBe(0);
    expect(jwtService.verify(token).memberId).toBe(member.id);
  });
});
