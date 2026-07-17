import { MinistryAccessPolicy, Actor } from '../MinistryAccessPolicy';
import { MinistryMembership } from '../../entities/MinistryMembership';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../repositories/MinistryMembershipRepository';

/**
 * Fake em memória do MinistryMembershipRepository — a policy só consulta
 * findByMemberAndMinistry; os demais métodos existem para satisfazer o contrato
 * e não são exercidos aqui.
 */
class FakeMembershipRepository implements MinistryMembershipRepository {
  memberships: MinistryMembership[] = [];

  async findByMemberAndMinistry(
    memberId: string,
    ministryId: string,
  ): Promise<MinistryMembership | null> {
    return (
      this.memberships.find((m) => m.memberId === memberId && m.ministryId === ministryId) ?? null
    );
  }

  async findMembersByMinistry(): Promise<MinistryMemberView[]> {
    return [];
  }
  async findMinistriesByMember(): Promise<MemberMinistryView[]> {
    return [];
  }
  async save(m: MinistryMembership): Promise<MinistryMembership> {
    this.memberships.push(m);
    return m;
  }
  async update(m: MinistryMembership): Promise<MinistryMembership> {
    return m;
  }
  async delete(): Promise<void> {}

  /** Não exercido aqui: lança para não passar despercebido se alguém passar a chamá-lo. */
  async replaceForMember(): Promise<void> {
    throw new Error("replaceForMember não é usado neste teste");
  }
}

const MINISTRY_ID = 'min-1';

const link = (memberId: string, isAdmin: boolean) =>
  MinistryMembership.create({ memberId, ministryId: MINISTRY_ID, isAdmin });

describe('MinistryAccessPolicy.canManage', () => {
  it('ADMIN_GERAL pode administrar qualquer ministério, sem consultar vínculo', async () => {
    const repo = new FakeMembershipRepository();
    const policy = new MinistryAccessPolicy(repo);
    const actor: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };

    expect(await policy.canManage(actor, MINISTRY_ID)).toBe(true);
    // Nenhum vínculo cadastrado, e ainda assim true — o papel global basta.
    expect(await policy.canManage(actor, 'outro-ministerio')).toBe(true);
  });

  it('ADMIN_MINISTERIO com isAdmin=true naquele ministério pode administrar', async () => {
    const repo = new FakeMembershipRepository();
    repo.memberships.push(link('am', true));
    const policy = new MinistryAccessPolicy(repo);

    expect(await policy.canManage({ memberId: 'am', role: 'ADMIN_MINISTERIO' }, MINISTRY_ID)).toBe(
      true,
    );
  });

  it('ADMIN_MINISTERIO com isAdmin=false (só participa) não pode administrar', async () => {
    const repo = new FakeMembershipRepository();
    repo.memberships.push(link('am', false));
    const policy = new MinistryAccessPolicy(repo);

    expect(await policy.canManage({ memberId: 'am', role: 'ADMIN_MINISTERIO' }, MINISTRY_ID)).toBe(
      false,
    );
  });

  it('ADMIN_MINISTERIO sem vínculo naquele ministério não pode administrar', async () => {
    const repo = new FakeMembershipRepository();
    repo.memberships.push(link('am', true)); // admin de OUTRO ministério
    const policy = new MinistryAccessPolicy(repo);

    expect(
      await policy.canManage({ memberId: 'am', role: 'ADMIN_MINISTERIO' }, 'ministerio-alheio'),
    ).toBe(false);
  });

  it('MEMBRO nunca pode administrar, mesmo com vínculo isAdmin=true', async () => {
    const repo = new FakeMembershipRepository();
    repo.memberships.push(link('mb', true));
    const policy = new MinistryAccessPolicy(repo);

    expect(await policy.canManage({ memberId: 'mb', role: 'MEMBRO' }, MINISTRY_ID)).toBe(false);
  });
});

describe('MinistryAccessPolicy.ensureCanManage', () => {
  it('não lança quando o ator pode administrar', async () => {
    const repo = new FakeMembershipRepository();
    const policy = new MinistryAccessPolicy(repo);

    await expect(
      policy.ensureCanManage({ memberId: 'ag', role: 'ADMIN_GERAL' }, MINISTRY_ID),
    ).resolves.toBeUndefined();
  });

  it('lança 403 quando o ator não pode administrar', async () => {
    const repo = new FakeMembershipRepository();
    const policy = new MinistryAccessPolicy(repo);

    await expect(
      policy.ensureCanManage({ memberId: 'mb', role: 'MEMBRO' }, MINISTRY_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
