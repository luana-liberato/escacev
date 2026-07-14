import { Unavailability } from '../../../entities/Unavailability';
import { Member } from '../../../entities/Member';
import { UnavailabilityRepository } from '../../../repositories/UnavailabilityRepository';
import { MemberRepository } from '../../../repositories/MemberRepository';
import { CreateUnavailabilityUseCase } from '../CreateUnavailabilityUseCase';
import { ListMyUnavailabilitiesUseCase } from '../ListMyUnavailabilitiesUseCase';
import { ListMemberUnavailabilitiesUseCase } from '../ListMemberUnavailabilitiesUseCase';
import { DeleteUnavailabilityUseCase } from '../DeleteUnavailabilityUseCase';

/**
 * Fake em memória do UnavailabilityRepository — não toca o banco. Cobre a
 * orquestração dos use cases isoladamente (nível unitário).
 */
class FakeUnavailabilityRepository implements UnavailabilityRepository {
  items: Unavailability[] = [];

  async findById(id: string): Promise<Unavailability | null> {
    return this.items.find((u) => u.id === id) ?? null;
  }

  async findByMember(memberId: string): Promise<Unavailability[]> {
    return this.items
      .filter((u) => u.memberId === memberId)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async findByMemberOverlapping(
    memberId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<Unavailability[]> {
    return this.items
      .filter((u) => u.memberId === memberId && u.startsAt < endsAt && u.endsAt > startsAt)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async save(unavailability: Unavailability): Promise<Unavailability> {
    this.items.push(unavailability);
    return unavailability;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((u) => u.id !== id);
  }
}

/** Fake mínimo do MemberRepository — só o findById é exercitado (checagem de tenant). */
class FakeMemberRepository implements MemberRepository {
  members: Member[] = [];
  async findById(id: string): Promise<Member | null> {
    return this.members.find((m) => m.id === id) ?? null;
  }
  async findByAccountId(): Promise<Member | null> {
    return null;
  }
  async findByEmailAndInstitution(): Promise<Member | null> {
    return null;
  }
  async findByInstitution(institutionId: string): Promise<Member[]> {
    return this.members.filter((m) => m.institutionId === institutionId);
  }
  async findPendingByEmail(): Promise<Member | null> {
    return null;
  }
  async save(m: Member): Promise<Member> {
    this.members.push(m);
    return m;
  }
  async update(m: Member): Promise<Member> {
    return m;
  }
  async linkAccount(): Promise<Member> {
    throw new Error('não usado neste teste');
  }
}

const d = (s: string) => new Date(s);

describe('CreateUnavailabilityUseCase', () => {
  it('registra uma indisponibilidade válida do membro', async () => {
    const repo = new FakeUnavailabilityRepository();
    const useCase = new CreateUnavailabilityUseCase(repo);

    const u = await useCase.execute({
      memberId: 'm1',
      startsAt: d('2026-07-12T18:00:00Z'),
      endsAt: d('2026-07-12T22:00:00Z'),
      reason: 'Viagem',
    });

    expect(u.id).toBeTruthy();
    expect(u.memberId).toBe('m1');
    expect(u.reason).toBe('Viagem');
    expect(repo.items).toHaveLength(1);
  });

  it('rejeita quando endsAt <= startsAt', async () => {
    const repo = new FakeUnavailabilityRepository();
    const useCase = new CreateUnavailabilityUseCase(repo);

    await expect(
      useCase.execute({
        memberId: 'm1',
        startsAt: d('2026-07-12T22:00:00Z'),
        endsAt: d('2026-07-12T18:00:00Z'),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('depois do início') });

    expect(repo.items).toHaveLength(0);
  });
});

describe('ListMyUnavailabilitiesUseCase', () => {
  it('lista só as do próprio membro, em ordem cronológica', async () => {
    const repo = new FakeUnavailabilityRepository();
    const createUC = new CreateUnavailabilityUseCase(repo);
    const listUC = new ListMyUnavailabilitiesUseCase(repo);

    await createUC.execute({ memberId: 'm1', startsAt: d('2026-08-01T10:00:00Z'), endsAt: d('2026-08-01T12:00:00Z') });
    await createUC.execute({ memberId: 'm1', startsAt: d('2026-07-01T10:00:00Z'), endsAt: d('2026-07-01T12:00:00Z') });
    await createUC.execute({ memberId: 'm2', startsAt: d('2026-07-01T10:00:00Z'), endsAt: d('2026-07-01T12:00:00Z') });

    const mine = await listUC.execute({ memberId: 'm1' });

    expect(mine).toHaveLength(2);
    expect(mine.every((u) => u.memberId === 'm1')).toBe(true);
    expect(mine[0].startsAt.getTime()).toBeLessThan(mine[1].startsAt.getTime()); // ordem cronológica
  });
});

describe('ListMemberUnavailabilitiesUseCase', () => {
  const INST = 'i1';

  it('admin lista as indisponibilidades de um membro da sua instituição (ordem cronológica)', async () => {
    const repo = new FakeUnavailabilityRepository();
    const memberRepo = new FakeMemberRepository();
    const member = Member.create({ institutionId: INST, name: 'João', email: 'joao@example.com' });
    await memberRepo.save(member);
    const createUC = new CreateUnavailabilityUseCase(repo);
    await createUC.execute({ memberId: member.id, startsAt: d('2026-08-01T10:00:00Z'), endsAt: d('2026-08-01T12:00:00Z') });
    await createUC.execute({ memberId: member.id, startsAt: d('2026-07-01T10:00:00Z'), endsAt: d('2026-07-01T12:00:00Z') });

    const items = await new ListMemberUnavailabilitiesUseCase(repo, memberRepo).execute({
      institutionId: INST,
      memberId: member.id,
    });

    expect(items).toHaveLength(2);
    expect(items[0].startsAt.getTime()).toBeLessThan(items[1].startsAt.getTime());
  });

  it('404 quando o membro é de outra instituição (não vaza dados de outro tenant)', async () => {
    const repo = new FakeUnavailabilityRepository();
    const memberRepo = new FakeMemberRepository();
    const member = Member.create({ institutionId: 'i2', name: 'Alheio', email: 'alheio@example.com' });
    await memberRepo.save(member);

    await expect(
      new ListMemberUnavailabilitiesUseCase(repo, memberRepo).execute({
        institutionId: INST,
        memberId: member.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 quando o membro não existe', async () => {
    const repo = new FakeUnavailabilityRepository();
    const memberRepo = new FakeMemberRepository();

    await expect(
      new ListMemberUnavailabilitiesUseCase(repo, memberRepo).execute({
        institutionId: INST,
        memberId: 'nao-existe',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DeleteUnavailabilityUseCase', () => {
  it('remove a indisponibilidade do próprio membro', async () => {
    const repo = new FakeUnavailabilityRepository();
    const createUC = new CreateUnavailabilityUseCase(repo);
    const deleteUC = new DeleteUnavailabilityUseCase(repo);

    const u = await createUC.execute({ memberId: 'm1', startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T22:00:00Z') });

    await deleteUC.execute({ id: u.id, memberId: 'm1' });

    expect(repo.items).toHaveLength(0);
  });

  it('404 ao tentar remover indisponibilidade de outro membro', async () => {
    const repo = new FakeUnavailabilityRepository();
    const createUC = new CreateUnavailabilityUseCase(repo);
    const deleteUC = new DeleteUnavailabilityUseCase(repo);

    const u = await createUC.execute({ memberId: 'm1', startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T22:00:00Z') });

    await expect(deleteUC.execute({ id: u.id, memberId: 'm2' })).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.items).toHaveLength(1); // não removeu
  });

  it('404 quando a indisponibilidade não existe', async () => {
    const repo = new FakeUnavailabilityRepository();
    const deleteUC = new DeleteUnavailabilityUseCase(repo);

    await expect(deleteUC.execute({ id: 'inexistente', memberId: 'm1' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
