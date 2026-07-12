import { Member } from '../../../entities/Member';
import { Ministry } from '../../../entities/Ministry';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { MemberRepository } from '../../../repositories/MemberRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../../repositories/MinistryMembershipRepository';
import { MinistryAccessPolicy, Actor } from '../../../services/MinistryAccessPolicy';
import { CreateMemberUseCase } from '../../members/CreateMemberUseCase';
import { AssociateMemberToMinistryUseCase } from '../AssociateMemberToMinistryUseCase';
import { SetMembershipAdminUseCase } from '../SetMembershipAdminUseCase';
import { RemoveMemberFromMinistryUseCase } from '../RemoveMemberFromMinistryUseCase';
import { ListMembershipsUseCase } from '../ListMembershipsUseCase';
import { InviteMemberToMinistryUseCase } from '../InviteMemberToMinistryUseCase';

// --- Fakes em memória (nível unitário, sem banco) ---

class FakeMemberRepository implements MemberRepository {
  members: Member[] = [];
  async findById(id: string): Promise<Member | null> {
    return this.members.find((m) => m.id === id) ?? null;
  }
  async findByAccountId(accountId: string): Promise<Member | null> {
    return this.members.find((m) => m.accountId === accountId) ?? null;
  }
  async findByEmailAndInstitution(email: string, institutionId: string): Promise<Member | null> {
    return (
      this.members.find((m) => m.email === email && m.institutionId === institutionId) ?? null
    );
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
    const member = this.members.find((m) => m.id === memberId)!;
    return this.update(Member.restore({ ...member, accountId }));
  }
}

class FakeMinistryRepository implements MinistryRepository {
  ministries: Ministry[] = [];
  async findById(id: string): Promise<Ministry | null> {
    return this.ministries.find((m) => m.id === id) ?? null;
  }
  async findByInstitution(institutionId: string): Promise<Ministry[]> {
    return this.ministries.filter((m) => m.institutionId === institutionId);
  }
  async findByName(name: string, institutionId: string): Promise<Ministry | null> {
    return (
      this.ministries.find(
        (m) => m.institutionId === institutionId && m.name.toLowerCase() === name.toLowerCase(),
      ) ?? null
    );
  }
  async save(m: Ministry): Promise<Ministry> {
    this.ministries.push(m);
    return m;
  }
  async update(m: Ministry): Promise<Ministry> {
    this.ministries = this.ministries.map((x) => (x.id === m.id ? m : x));
    return m;
  }
  async delete(id: string): Promise<void> {
    this.ministries = this.ministries.filter((m) => m.id !== id);
  }
  async countBlockingDependencies(): Promise<MinistryBlockingDependencies> {
    return { schedules: 0, functionsInUse: 0 };
  }
}

class FakeMembershipRepository implements MinistryMembershipRepository {
  memberships: MinistryMembership[] = [];
  deleted: string[] = [];
  async findByMemberAndMinistry(m: string, min: string): Promise<MinistryMembership | null> {
    return this.memberships.find((x) => x.memberId === m && x.ministryId === min) ?? null;
  }
  async findMembersByMinistry(ministryId: string): Promise<MinistryMemberView[]> {
    return this.memberships
      .filter((x) => x.ministryId === ministryId)
      .map((membership) => ({ membership, member: {} as Member }));
  }
  async findMinistriesByMember(memberId: string): Promise<MemberMinistryView[]> {
    return this.memberships
      .filter((x) => x.memberId === memberId)
      .map((membership) => ({ membership, ministry: {} as Ministry }));
  }
  async save(m: MinistryMembership): Promise<MinistryMembership> {
    this.memberships.push(m);
    return m;
  }
  async update(m: MinistryMembership): Promise<MinistryMembership> {
    this.memberships = this.memberships.map((x) => (x.id === m.id ? m : x));
    return m;
  }
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.memberships = this.memberships.filter((x) => x.id !== id);
  }
}

const INST = 'i1';
const ADMIN_GERAL: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };

/** Monta as fakes + um ministério e um membro na instituição padrão. */
async function scenario() {
  const memberRepo = new FakeMemberRepository();
  const ministryRepo = new FakeMinistryRepository();
  const membershipRepo = new FakeMembershipRepository();
  const policy = new MinistryAccessPolicy(membershipRepo);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);
  const member = Member.create({ institutionId: INST, name: 'João', email: 'joao@example.com' });
  await memberRepo.save(member);

  return { memberRepo, ministryRepo, membershipRepo, policy, ministry, member };
}

describe('AssociateMemberToMinistryUseCase', () => {
  it('ADMIN_GERAL associa um membro (participa) com isAdmin repassado', async () => {
    const s = await scenario();
    const useCase = new AssociateMemberToMinistryUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.memberRepo,
      s.policy,
    );

    const membership = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: true,
    });

    expect(membership.memberId).toBe(s.member.id);
    expect(membership.isAdmin).toBe(true);
    expect(s.membershipRepo.memberships).toHaveLength(1);
  });

  it('rejeita associação duplicada (409)', async () => {
    const s = await scenario();
    const useCase = new AssociateMemberToMinistryUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.memberRepo,
      s.policy,
    );
    const dto = {
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
    };
    await useCase.execute(dto);

    await expect(useCase.execute(dto)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('ADMIN_MINISTERIO sem isAdmin no ministério recebe 403', async () => {
    const s = await scenario();
    const useCase = new AssociateMemberToMinistryUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.memberRepo,
      s.policy,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        ministryId: s.ministry.id,
        memberId: s.member.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404 quando o membro é de outra instituição', async () => {
    const s = await scenario();
    const foreign = Member.create({ institutionId: 'i2', name: 'X', email: 'x@example.com' });
    await s.memberRepo.save(foreign);
    const useCase = new AssociateMemberToMinistryUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.memberRepo,
      s.policy,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        ministryId: s.ministry.id,
        memberId: foreign.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('SetMembershipAdminUseCase', () => {
  it('promove e depois rebaixa o admin de um vínculo existente', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );
    const useCase = new SetMembershipAdminUseCase(s.membershipRepo, s.ministryRepo, s.policy);

    const promoted = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: true,
    });
    expect(promoted.isAdmin).toBe(true);

    const demoted = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: false,
    });
    expect(demoted.isAdmin).toBe(false);
  });

  it('404 quando o vínculo não existe', async () => {
    const s = await scenario();
    const useCase = new SetMembershipAdminUseCase(s.membershipRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        ministryId: s.ministry.id,
        memberId: s.member.id,
        isAdmin: true,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('RemoveMemberFromMinistryUseCase', () => {
  it('remove um vínculo existente', async () => {
    const s = await scenario();
    const membership = await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );
    const useCase = new RemoveMemberFromMinistryUseCase(s.membershipRepo, s.ministryRepo, s.policy);

    await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
    });

    expect(s.membershipRepo.deleted).toContain(membership.id);
    expect(s.membershipRepo.memberships).toHaveLength(0);
  });

  it('404 quando não há vínculo para remover', async () => {
    const s = await scenario();
    const useCase = new RemoveMemberFromMinistryUseCase(s.membershipRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        ministryId: s.ministry.id,
        memberId: s.member.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ListMembershipsUseCase', () => {
  it('lista membros de um ministério da própria instituição', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id, isAdmin: true }),
    );
    const useCase = new ListMembershipsUseCase(s.membershipRepo, s.ministryRepo, s.memberRepo);

    const rows = await useCase.membersOfMinistry({
      institutionId: INST,
      ministryId: s.ministry.id,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].membership.isAdmin).toBe(true);
  });

  it('404 ao listar membros de ministério de outra instituição', async () => {
    const s = await scenario();
    const useCase = new ListMembershipsUseCase(s.membershipRepo, s.ministryRepo, s.memberRepo);

    await expect(
      useCase.membersOfMinistry({ institutionId: 'i2', ministryId: s.ministry.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 ao listar ministérios de membro de outra instituição', async () => {
    const s = await scenario();
    const useCase = new ListMembershipsUseCase(s.membershipRepo, s.ministryRepo, s.memberRepo);

    await expect(
      useCase.ministriesOfMember({ institutionId: 'i2', memberId: s.member.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('InviteMemberToMinistryUseCase', () => {
  function buildInvite(s: Awaited<ReturnType<typeof scenario>>) {
    const createMember = new CreateMemberUseCase(s.memberRepo);
    return new InviteMemberToMinistryUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.memberRepo,
      createMember,
      s.policy,
    );
  }

  it('e-mail novo: cria o Membro e associa (created = true)', async () => {
    const s = await scenario();
    const invite = buildInvite(s);

    const result = await invite.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'Maria',
      email: 'maria@example.com',
    });

    expect(result.created).toBe(true);
    expect(result.member.email).toBe('maria@example.com');
    expect(s.membershipRepo.memberships).toHaveLength(1);
  });

  it('e-mail existente fora do ministério: só associa (created = false)', async () => {
    const s = await scenario(); // já tem s.member joao@example.com
    const invite = buildInvite(s);

    const result = await invite.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'João',
      email: 'joao@example.com',
    });

    expect(result.created).toBe(false);
    expect(result.member.id).toBe(s.member.id);
    expect(s.membershipRepo.memberships).toHaveLength(1);
  });

  it('e-mail já no ministério: 409', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );
    const invite = buildInvite(s);

    await expect(
      invite.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        ministryId: s.ministry.id,
        name: 'João',
        email: 'joao@example.com',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('ADMIN_MINISTERIO nunca define isAdmin=true (força false) mesmo pedindo true', async () => {
    const s = await scenario();
    // torna 'am' admin escopado do ministério para passar a guarda
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: 'am', ministryId: s.ministry.id, isAdmin: true }),
    );
    const invite = buildInvite(s);

    const result = await invite.execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      ministryId: s.ministry.id,
      name: 'Novo',
      email: 'novo@example.com',
      isAdmin: true, // pedido ignorado para ADMIN_MINISTERIO
    });

    expect(result.membership.isAdmin).toBe(false);
  });

  it('ADMIN_GERAL pode convidar já como admin do ministério (isAdmin=true)', async () => {
    const s = await scenario();
    const invite = buildInvite(s);

    const result = await invite.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'Chefe',
      email: 'chefe@example.com',
      isAdmin: true,
    });

    expect(result.membership.isAdmin).toBe(true);
  });
});
