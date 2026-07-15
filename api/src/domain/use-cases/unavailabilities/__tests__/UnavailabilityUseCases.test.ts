import { Unavailability } from '../../../entities/Unavailability';
import { Member } from '../../../entities/Member';
import { Assignment } from '../../../entities/Assignment';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { UnavailabilityRepository } from '../../../repositories/UnavailabilityRepository';
import { MemberRepository } from '../../../repositories/MemberRepository';
import {
  AssignmentRepository,
  AssignmentDetail,
  MemberAssignmentContext,
  MemberScheduleEntry,
} from '../../../repositories/AssignmentRepository';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../../repositories/MinistryMembershipRepository';
import { RecordingNotifier } from '../../../../test/fakeNotifier';
import { CreateUnavailabilityUseCase } from '../CreateUnavailabilityUseCase';
import { ListMyUnavailabilitiesUseCase } from '../ListMyUnavailabilitiesUseCase';
import { ListMemberUnavailabilitiesUseCase } from '../ListMemberUnavailabilitiesUseCase';
import { DeleteUnavailabilityUseCase } from '../DeleteUnavailabilityUseCase';

/**
 * Fakes mínimos para o alerta de indisponibilidade (RN05, visão do admin). O de
 * alocação só precisa de findByMemberWithContext (a varredura publicada×período);
 * o de vínculo, de findMembersByMinistry (os admins do ministério). Os demais
 * métodos são stubs para satisfazer o contrato.
 */
class FakeAssignmentRepo implements AssignmentRepository {
  // Contextos do membro consultado (a query real é sempre WHERE membroId = memberId,
  // então o teste popula só os deste membro).
  contexts: MemberAssignmentContext[] = [];
  async findById(): Promise<Assignment | null> {
    return null;
  }
  async findByScheduleWithDetails(): Promise<AssignmentDetail[]> {
    return [];
  }
  async findByMemberWithContext(): Promise<MemberAssignmentContext[]> {
    return this.contexts;
  }
  async findByMemberPublishedInRange(): Promise<MemberScheduleEntry[]> {
    return [];
  }
  async save(a: Assignment): Promise<Assignment> {
    return a;
  }
  async update(a: Assignment): Promise<Assignment> {
    return a;
  }
  async delete(): Promise<void> {}
  async existsByScheduleMemberPosition(): Promise<boolean> {
    return false;
  }
}

class FakeMembershipRepo implements MinistryMembershipRepository {
  views: Map<string, MinistryMemberView[]> = new Map();
  async findByMemberAndMinistry(): Promise<MinistryMembership | null> {
    return null;
  }
  async findMembersByMinistry(ministryId: string): Promise<MinistryMemberView[]> {
    return this.views.get(ministryId) ?? [];
  }
  async findMinistriesByMember(): Promise<MemberMinistryView[]> {
    return [];
  }
  async save(m: MinistryMembership): Promise<MinistryMembership> {
    return m;
  }
  async update(m: MinistryMembership): Promise<MinistryMembership> {
    return m;
  }
  async delete(): Promise<void> {}
}

/** Constrói o CreateUnavailabilityUseCase com fakes padrão (sem alertas) ou os fornecidos. */
function makeCreateUC(
  repo: UnavailabilityRepository,
  opts?: {
    assignmentRepo?: AssignmentRepository;
    membershipRepo?: MinistryMembershipRepository;
    notifier?: RecordingNotifier;
  },
): CreateUnavailabilityUseCase {
  return new CreateUnavailabilityUseCase(
    repo,
    opts?.assignmentRepo ?? new FakeAssignmentRepo(),
    opts?.membershipRepo ?? new FakeMembershipRepo(),
    opts?.notifier ?? new RecordingNotifier(),
  );
}

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
    const useCase = makeCreateUC(repo);

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
    const useCase = makeCreateUC(repo);

    await expect(
      useCase.execute({
        memberId: 'm1',
        startsAt: d('2026-07-12T22:00:00Z'),
        endsAt: d('2026-07-12T18:00:00Z'),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('depois do início') });

    expect(repo.items).toHaveLength(0);
  });

  /** Contexto de alocação já publicada, evento 12/07 18h-20h — base dos testes de alerta. */
  function ctx(over: Partial<MemberAssignmentContext> = {}): MemberAssignmentContext {
    return {
      assignmentId: 'a1',
      memberName: 'João',
      scheduleId: 's1',
      schedulePublishedAt: d('2026-07-01T00:00:00Z'),
      ministryId: 'min1',
      ministryName: 'Louvor',
      eventId: 'ev1',
      eventName: 'Culto',
      positionId: 'p1',
      positionName: 'Vocal',
      startsAt: d('2026-07-12T18:00:00Z'),
      endsAt: d('2026-07-12T20:00:00Z'),
      ...over,
    };
  }

  function adminView(admin: Member): MinistryMemberView {
    return {
      membership: MinistryMembership.create({ memberId: admin.id, ministryId: 'min1', isAdmin: true }),
      member: admin,
    };
  }

  it('alerta o admin do ministério quando conflita com escala PUBLICADA (RN05)', async () => {
    const repo = new FakeUnavailabilityRepository();
    const assignmentRepo = new FakeAssignmentRepo();
    assignmentRepo.contexts = [ctx()];
    const admin = Member.create({ institutionId: 'i1', name: 'Ana', email: 'ana@ex.com', role: 'ADMIN_MINISTERIO' });
    const membershipRepo = new FakeMembershipRepo();
    membershipRepo.views.set('min1', [adminView(admin)]);
    const notifier = new RecordingNotifier();

    // Janela 19h-23h sobrepõe o evento 18h-20h.
    await makeCreateUC(repo, { assignmentRepo, membershipRepo, notifier }).execute({
      memberId: 'm1', startsAt: d('2026-07-12T19:00:00Z'), endsAt: d('2026-07-12T23:00:00Z'),
    });

    expect(notifier.conflicts).toEqual([
      { adminId: admin.id, adminEmail: 'ana@ex.com', memberName: 'João', eventName: 'Culto' },
    ]);
  });

  it('não alerta quando a escala do conflito ainda é RASCUNHO (schedulePublishedAt null)', async () => {
    const repo = new FakeUnavailabilityRepository();
    const assignmentRepo = new FakeAssignmentRepo();
    assignmentRepo.contexts = [ctx({ schedulePublishedAt: null })];
    const admin = Member.create({ institutionId: 'i1', name: 'Ana', email: 'ana@ex.com' });
    const membershipRepo = new FakeMembershipRepo();
    membershipRepo.views.set('min1', [adminView(admin)]);
    const notifier = new RecordingNotifier();

    await makeCreateUC(repo, { assignmentRepo, membershipRepo, notifier }).execute({
      memberId: 'm1', startsAt: d('2026-07-12T19:00:00Z'), endsAt: d('2026-07-12T23:00:00Z'),
    });

    expect(notifier.conflicts).toHaveLength(0);
  });

  it('não alerta quando não há sobreposição de horário', async () => {
    const repo = new FakeUnavailabilityRepository();
    const assignmentRepo = new FakeAssignmentRepo();
    assignmentRepo.contexts = [ctx()]; // evento 18h-20h
    const admin = Member.create({ institutionId: 'i1', name: 'Ana', email: 'ana@ex.com' });
    const membershipRepo = new FakeMembershipRepo();
    membershipRepo.views.set('min1', [adminView(admin)]);
    const notifier = new RecordingNotifier();

    // Janela 21h-23h NÃO sobrepõe o evento 18h-20h.
    await makeCreateUC(repo, { assignmentRepo, membershipRepo, notifier }).execute({
      memberId: 'm1', startsAt: d('2026-07-12T21:00:00Z'), endsAt: d('2026-07-12T23:00:00Z'),
    });

    expect(notifier.conflicts).toHaveLength(0);
  });

  it('não alerta o próprio membro que ficou indisponível, mesmo sendo admin do ministério', async () => {
    const repo = new FakeUnavailabilityRepository();
    const assignmentRepo = new FakeAssignmentRepo();
    assignmentRepo.contexts = [ctx()];
    const self = Member.create({ institutionId: 'i1', name: 'João', email: 'joao@ex.com', role: 'ADMIN_MINISTERIO' });
    const membershipRepo = new FakeMembershipRepo();
    membershipRepo.views.set('min1', [adminView(self)]);
    const notifier = new RecordingNotifier();

    await makeCreateUC(repo, { assignmentRepo, membershipRepo, notifier }).execute({
      memberId: self.id, startsAt: d('2026-07-12T19:00:00Z'), endsAt: d('2026-07-12T23:00:00Z'),
    });

    expect(notifier.conflicts).toHaveLength(0);
  });
});

describe('ListMyUnavailabilitiesUseCase', () => {
  it('lista só as do próprio membro, em ordem cronológica', async () => {
    const repo = new FakeUnavailabilityRepository();
    const createUC = makeCreateUC(repo);
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
    const createUC = makeCreateUC(repo);
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
    const createUC = makeCreateUC(repo);
    const deleteUC = new DeleteUnavailabilityUseCase(repo);

    const u = await createUC.execute({ memberId: 'm1', startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T22:00:00Z') });

    await deleteUC.execute({ id: u.id, memberId: 'm1' });

    expect(repo.items).toHaveLength(0);
  });

  it('404 ao tentar remover indisponibilidade de outro membro', async () => {
    const repo = new FakeUnavailabilityRepository();
    const createUC = makeCreateUC(repo);
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
