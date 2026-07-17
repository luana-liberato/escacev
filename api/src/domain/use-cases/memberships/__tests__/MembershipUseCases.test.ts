import { Member } from '../../../entities/Member';
import { Ministry } from '../../../entities/Ministry';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { MemberRepository } from '../../../repositories/MemberRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import {
  MemberMinistryLink,
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../../repositories/MinistryMembershipRepository';
import { MinistryAccessPolicy, Actor } from '../../../services/MinistryAccessPolicy';
import { RecordingNotifier } from '../../../../test/fakeNotifier';
import { CreateMemberUseCase } from '../../members/CreateMemberUseCase';
import { AssociateMemberToMinistryUseCase } from '../AssociateMemberToMinistryUseCase';
import { SetMembershipAdminUseCase } from '../SetMembershipAdminUseCase';
import { RemoveMemberFromMinistryUseCase } from '../RemoveMemberFromMinistryUseCase';
import { ListMembershipsUseCase } from '../ListMembershipsUseCase';
import { InviteMemberToMinistryUseCase } from '../InviteMemberToMinistryUseCase';
import { SetMemberMinistriesUseCase } from '../SetMemberMinistriesUseCase';

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
  /**
   * Espelha a semântica do Prisma: remove o que saiu, cria o que entrou e ajusta
   * o isAdmin de quem mudou de papel. O fake precisa refletir isso, senão o teste
   * passaria por um motivo errado.
   */
  async replaceForMember(memberId: string, links: MemberMinistryLink[]): Promise<void> {
    const wanted = new Map(links.map((l) => [l.ministryId, l.isAdmin]));

    this.memberships = this.memberships
      .filter((x) => x.memberId !== memberId || wanted.has(x.ministryId))
      .map((x) =>
        x.memberId === memberId && wanted.get(x.ministryId) !== x.isAdmin
          ? MinistryMembership.restore({ ...x, isAdmin: wanted.get(x.ministryId)! })
          : x,
      );

    const currentIds = this.memberships
      .filter((x) => x.memberId === memberId)
      .map((x) => x.ministryId);
    for (const link of links) {
      if (!currentIds.includes(link.ministryId)) {
        this.memberships.push(
          MinistryMembership.create({
            memberId,
            ministryId: link.ministryId,
            isAdmin: link.isAdmin,
          }),
        );
      }
    }
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
    const useCase = new SetMembershipAdminUseCase(s.membershipRepo, s.ministryRepo, s.policy, s.memberRepo);

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
    const useCase = new SetMembershipAdminUseCase(s.membershipRepo, s.ministryRepo, s.policy, s.memberRepo);

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
    const notifier = new RecordingNotifier();
    const createMember = new CreateMemberUseCase(s.memberRepo, notifier);
    const useCase = new InviteMemberToMinistryUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.memberRepo,
      createMember,
      s.policy,
    );
    return { useCase, notifier };
  }

  it('e-mail novo: cria o Membro e associa (created = true) e dispara o convite', async () => {
    const s = await scenario();
    const { useCase, notifier } = buildInvite(s);

    const result = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'Maria',
      email: 'maria@example.com',
    });

    expect(result.created).toBe(true);
    expect(result.member.email).toBe('maria@example.com');
    expect(s.membershipRepo.memberships).toHaveLength(1);
    // Membro novo → convite disparado (via CreateMemberUseCase delegado).
    expect(notifier.invited).toEqual([{ to: 'maria@example.com', memberName: 'Maria' }]);
  });

  it('e-mail existente fora do ministério: só associa (created = false), SEM convite', async () => {
    const s = await scenario(); // já tem s.member joao@example.com
    const { useCase, notifier } = buildInvite(s);

    const result = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'João',
      email: 'joao@example.com',
    });

    expect(result.created).toBe(false);
    expect(result.member.id).toBe(s.member.id);
    expect(s.membershipRepo.memberships).toHaveLength(1);
    // Membro já existia → nenhum convite (ele já está na instituição).
    expect(notifier.invited).toHaveLength(0);
  });

  it('e-mail já no ministério: 409', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );
    const { useCase } = buildInvite(s);

    await expect(
      useCase.execute({
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
    const { useCase } = buildInvite(s);

    const result = await useCase.execute({
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
    const { useCase } = buildInvite(s);

    const result = await useCase.execute({
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


describe('SetMemberMinistriesUseCase', () => {
  /** Cenário com dois ministérios extras, para exercitar entrada e saída. */
  async function multiMinistryScenario() {
    const s = await scenario();
    const infantil = Ministry.create({ institutionId: INST, name: 'Infantil' });
    const midia = Ministry.create({ institutionId: INST, name: 'Mídia' });
    await s.ministryRepo.save(infantil);
    await s.ministryRepo.save(midia);

    const useCase = new SetMemberMinistriesUseCase(s.membershipRepo, s.memberRepo, s.ministryRepo);
    return { ...s, infantil, midia, useCase };
  }

  const linksOf = (repo: FakeMembershipRepository, memberId: string) =>
    repo.memberships
      .filter((m) => m.memberId === memberId)
      .map((m) => ({ ministryId: m.ministryId, isAdmin: m.isAdmin }))
      .sort((a, b) => a.ministryId.localeCompare(b.ministryId));

  it('substitui o conjunto: remove o que saiu e cria o que entrou', async () => {
    const s = await multiMinistryScenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.infantil.id }),
    );

    // Sai o Infantil, entra a Mídia; o Louvor permanece.
    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id }, { ministryId: s.midia.id }],
    });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual(
      [
        { ministryId: s.ministry.id, isAdmin: false },
        { ministryId: s.midia.id, isAdmin: false },
      ].sort((a, b) => a.ministryId.localeCompare(b.ministryId)),
    );
  });

  /**
   * O caso que motivou o endpoint carregar o isAdmin: sem isto, um
   * ADMIN_MINISTERIO ficaria com o perfil global mas sem administrar nada — e
   * levaria 403 da MinistryAccessPolicy em toda ação escopada.
   */
  it('promove: marcar isAdmin num vínculo que já existia', async () => {
    const s = await multiMinistryScenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id, isAdmin: true }],
    });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([
      { ministryId: s.ministry.id, isAdmin: true },
    ]);
  });

  it('rebaixa: desmarcar isAdmin de quem administrava', async () => {
    const s = await multiMinistryScenario();
    await s.membershipRepo.save(
      MinistryMembership.create({
        memberId: s.member.id,
        ministryId: s.ministry.id,
        isAdmin: true,
      }),
    );

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id, isAdmin: false }],
    });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([
      { ministryId: s.ministry.id, isAdmin: false },
    ]);
  });

  it('cria o vínculo novo já como admin', async () => {
    const s = await multiMinistryScenario();

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.midia.id, isAdmin: true }],
    });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([
      { ministryId: s.midia.id, isAdmin: true },
    ]);
  });

  it('isAdmin ausente vira participante (não herda o que estava lá)', async () => {
    const s = await multiMinistryScenario();
    await s.membershipRepo.save(
      MinistryMembership.create({
        memberId: s.member.id,
        ministryId: s.ministry.id,
        isAdmin: true,
      }),
    );

    // A lista é a fonte da verdade: sem isAdmin, o vínculo é de participação.
    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id }],
    });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([
      { ministryId: s.ministry.id, isAdmin: false },
    ]);
  });

  it('lista vazia remove o membro de todos os ministérios', async () => {
    const s = await multiMinistryScenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );

    await s.useCase.execute({ institutionId: INST, memberId: s.member.id, ministries: [] });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([]);
  });

  it('ministério repetido não duplica o vínculo (o último vence)', async () => {
    const s = await multiMinistryScenario();

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [
        { ministryId: s.ministry.id, isAdmin: false },
        { ministryId: s.ministry.id, isAdmin: true },
      ],
    });

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([
      { ministryId: s.ministry.id, isAdmin: true },
    ]);
  });

  it('404 para ministério de outra instituição (não cruza o tenant)', async () => {
    const s = await multiMinistryScenario();
    const foreign = Ministry.create({ institutionId: 'outra-inst', name: 'De Fora' });
    await s.ministryRepo.save(foreign);

    await expect(
      s.useCase.execute({
        institutionId: INST,
        memberId: s.member.id,
        ministries: [{ ministryId: foreign.id }],
      }),
    ).rejects.toThrow('Ministério não encontrado');

    expect(linksOf(s.membershipRepo, s.member.id)).toEqual([]);
  });

  it('404 para membro de outra instituição', async () => {
    const s = await multiMinistryScenario();

    await expect(
      s.useCase.execute({ institutionId: 'outra-inst', memberId: s.member.id, ministries: [] }),
    ).rejects.toThrow('Membro não encontrado');
  });

  it('400 quando ministries não é uma lista', async () => {
    const s = await multiMinistryScenario();

    await expect(
      s.useCase.execute({ institutionId: INST, memberId: s.member.id, ministries: 'louvor' }),
    ).rejects.toThrow('ministries deve ser uma lista de vínculos');
  });

  it('400 quando isAdmin não é booleano', async () => {
    const s = await multiMinistryScenario();

    await expect(
      s.useCase.execute({
        institutionId: INST,
        memberId: s.member.id,
        ministries: [{ ministryId: s.ministry.id, isAdmin: 'sim' }],
      }),
    ).rejects.toThrow('isAdmin deve ser um booleano');
  });
});

describe('SetMemberMinistriesUseCase — perfil derivado', () => {
  async function derivationScenario(role: 'MEMBRO' | 'ADMIN_MINISTERIO' | 'ADMIN_GERAL') {
    const memberRepo = new FakeMemberRepository();
    const ministryRepo = new FakeMinistryRepository();
    const membershipRepo = new FakeMembershipRepository();

    const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
    await ministryRepo.save(ministry);
    const member = Member.create({
      institutionId: INST,
      name: 'João',
      email: 'joao@example.com',
      role,
    });
    await memberRepo.save(member);

    const useCase = new SetMemberMinistriesUseCase(membershipRepo, memberRepo, ministryRepo);
    return { memberRepo, ministryRepo, membershipRepo, ministry, member, useCase };
  }

  const roleOf = async (repo: FakeMemberRepository, id: string) =>
    (await repo.findById(id))?.role;

  /**
   * A razão de derivar: "administrador de grupo" não diz de QUAL grupo. Marcar
   * admin num ministério é o que torna alguém admin de grupo — não um select.
   */
  it('marcar admin num ministério promove o MEMBRO a ADMIN_MINISTERIO', async () => {
    const s = await derivationScenario('MEMBRO');

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id, isAdmin: true }],
    });

    expect(await roleOf(s.memberRepo, s.member.id)).toBe('ADMIN_MINISTERIO');
  });

  it('deixar de administrar todos rebaixa o ADMIN_MINISTERIO a MEMBRO', async () => {
    const s = await derivationScenario('ADMIN_MINISTERIO');
    await s.membershipRepo.save(
      MinistryMembership.create({
        memberId: s.member.id,
        ministryId: s.ministry.id,
        isAdmin: true,
      }),
    );

    // Continua participando, mas não administra mais.
    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id, isAdmin: false }],
    });

    expect(await roleOf(s.memberRepo, s.member.id)).toBe('MEMBRO');
  });

  it('participar sem administrar não promove ninguém', async () => {
    const s = await derivationScenario('MEMBRO');

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id, isAdmin: false }],
    });

    expect(await roleOf(s.memberRepo, s.member.id)).toBe('MEMBRO');
  });

  /**
   * O poder do ADMIN_GERAL é da INSTITUIÇÃO e não vem de vínculo — participar de
   * um ministério (ser escalável, Seção 1 do CLAUDE.md) não pode rebaixá-lo.
   */
  it('ADMIN_GERAL não é rebaixado ao participar sem administrar', async () => {
    const s = await derivationScenario('ADMIN_GERAL');

    await s.useCase.execute({
      institutionId: INST,
      memberId: s.member.id,
      ministries: [{ ministryId: s.ministry.id, isAdmin: false }],
    });

    expect(await roleOf(s.memberRepo, s.member.id)).toBe('ADMIN_GERAL');
  });

  it('ADMIN_GERAL não é rebaixado ao sair de todos os ministérios', async () => {
    const s = await derivationScenario('ADMIN_GERAL');

    await s.useCase.execute({ institutionId: INST, memberId: s.member.id, ministries: [] });

    expect(await roleOf(s.memberRepo, s.member.id)).toBe('ADMIN_GERAL');
  });
});

/**
 * A derivação precisa valer em TODA porta que mexe em isAdmin — não só no
 * SetMemberMinistries. É por aqui que o botão "Promover" do admin de grupo passa.
 */
describe('SetMembershipAdminUseCase — deriva o perfil', () => {
  it('promover no vínculo torna o MEMBRO um ADMIN_MINISTERIO (senão seria admin sem poder)', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: s.ministry.id }),
    );

    await new SetMembershipAdminUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.policy,
      s.memberRepo,
    ).execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: true,
    });

    expect((await s.memberRepo.findById(s.member.id))?.role).toBe('ADMIN_MINISTERIO');
  });

  it('rebaixar no único vínculo devolve a MEMBRO', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({
        memberId: s.member.id,
        ministryId: s.ministry.id,
        isAdmin: true,
      }),
    );
    await s.memberRepo.update(s.member.update({ role: 'ADMIN_MINISTERIO' }));

    await new SetMembershipAdminUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.policy,
      s.memberRepo,
    ).execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: false,
    });

    expect((await s.memberRepo.findById(s.member.id))?.role).toBe('MEMBRO');
  });

  it('quem ainda administra OUTRO ministério continua ADMIN_MINISTERIO', async () => {
    const s = await scenario();
    const infantil = Ministry.create({ institutionId: INST, name: 'Infantil' });
    await s.ministryRepo.save(infantil);
    await s.membershipRepo.save(
      MinistryMembership.create({
        memberId: s.member.id,
        ministryId: s.ministry.id,
        isAdmin: true,
      }),
    );
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: s.member.id, ministryId: infantil.id, isAdmin: true }),
    );
    await s.memberRepo.update(s.member.update({ role: 'ADMIN_MINISTERIO' }));

    // Perde o Louvor, mas segue admin do Infantil.
    await new SetMembershipAdminUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.policy,
      s.memberRepo,
    ).execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: false,
    });

    expect((await s.memberRepo.findById(s.member.id))?.role).toBe('ADMIN_MINISTERIO');
  });

  it('ADMIN_GERAL não é rebaixado ao perder o admin de um ministério', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({
        memberId: s.member.id,
        ministryId: s.ministry.id,
        isAdmin: true,
      }),
    );
    await s.memberRepo.update(s.member.update({ role: 'ADMIN_GERAL' }));

    await new SetMembershipAdminUseCase(
      s.membershipRepo,
      s.ministryRepo,
      s.policy,
      s.memberRepo,
    ).execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      memberId: s.member.id,
      isAdmin: false,
    });

    expect((await s.memberRepo.findById(s.member.id))?.role).toBe('ADMIN_GERAL');
  });
});
