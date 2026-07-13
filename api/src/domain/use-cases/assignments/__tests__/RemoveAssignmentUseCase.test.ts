import { Assignment } from '../../../entities/Assignment';
import { Ministry } from '../../../entities/Ministry';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { Schedule } from '../../../entities/Schedule';
import { AssignmentDetail, AssignmentRepository } from '../../../repositories/AssignmentRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../../repositories/MinistryMembershipRepository';
import { ScheduleRepository } from '../../../repositories/ScheduleRepository';
import { Actor, MinistryAccessPolicy } from '../../../services/MinistryAccessPolicy';
import { RemoveAssignmentUseCase } from '../RemoveAssignmentUseCase';

// --- Fakes em memória (nível unitário, sem banco) ---

class FakeMinistryRepository implements MinistryRepository {
  ministries: Ministry[] = [];
  async findById(id: string): Promise<Ministry | null> {
    return this.ministries.find((m) => m.id === id) ?? null;
  }
  async findByInstitution(institutionId: string): Promise<Ministry[]> {
    return this.ministries.filter((m) => m.institutionId === institutionId);
  }
  async findByName(): Promise<Ministry | null> {
    return null;
  }
  async save(m: Ministry): Promise<Ministry> {
    this.ministries.push(m);
    return m;
  }
  async update(m: Ministry): Promise<Ministry> {
    return m;
  }
  async delete(): Promise<void> {}
  async countBlockingDependencies(): Promise<MinistryBlockingDependencies> {
    return { schedules: 0, functionsInUse: 0 };
  }
}

class FakeScheduleRepository implements ScheduleRepository {
  schedules: Schedule[] = [];
  async findById(id: string): Promise<Schedule | null> {
    return this.schedules.find((s) => s.id === id) ?? null;
  }
  async findByMinistryEventAndName(): Promise<Schedule | null> {
    return null;
  }
  async findByMinistryAndEvent(): Promise<Schedule[]> {
    return [];
  }
  async findByEvent(): Promise<Schedule[]> {
    return [];
  }
  async findByMinistry(): Promise<Schedule[]> {
    return [];
  }
  async findByInstitution(): Promise<Schedule[]> {
    return [];
  }
  async save(s: Schedule): Promise<Schedule> {
    this.schedules.push(s);
    return s;
  }
  async delete(): Promise<void> {}
}

class FakeMembershipRepository implements MinistryMembershipRepository {
  memberships: MinistryMembership[] = [];
  async findByMemberAndMinistry(m: string, min: string): Promise<MinistryMembership | null> {
    return this.memberships.find((x) => x.memberId === m && x.ministryId === min) ?? null;
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
}

class FakeAssignmentRepository implements AssignmentRepository {
  assignments: Assignment[] = [];
  deleted: string[] = [];
  async findById(id: string): Promise<Assignment | null> {
    return this.assignments.find((a) => a.id === id) ?? null;
  }
  async save(assignment: Assignment): Promise<Assignment> {
    this.assignments.push(assignment);
    return assignment;
  }
  async update(assignment: Assignment): Promise<Assignment> {
    return assignment;
  }
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.assignments = this.assignments.filter((a) => a.id !== id);
  }
  async existsByScheduleMemberPosition(): Promise<boolean> {
    return false;
  }
  async findByScheduleWithDetails(): Promise<AssignmentDetail[]> {
    return []; // não exercitado neste arquivo
  }
}

const INST = 'i1';
const ADMIN_GERAL: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };

async function scenario() {
  const ministryRepo = new FakeMinistryRepository();
  const scheduleRepo = new FakeScheduleRepository();
  const membershipRepo = new FakeMembershipRepository();
  const assignmentRepo = new FakeAssignmentRepository();
  const policy = new MinistryAccessPolicy(membershipRepo);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);
  const schedule = Schedule.create({ ministryId: ministry.id, eventId: 'ev1' });
  await scheduleRepo.save(schedule);
  const assignment = Assignment.create({ scheduleId: schedule.id, memberId: 'mb1', positionId: 'ps1' });
  await assignmentRepo.save(assignment);

  const useCase = new RemoveAssignmentUseCase(assignmentRepo, scheduleRepo, ministryRepo, policy);

  return { ministryRepo, scheduleRepo, membershipRepo, assignmentRepo, ministry, schedule, assignment, useCase };
}

describe('RemoveAssignmentUseCase', () => {
  it('remove uma alocação existente', async () => {
    const s = await scenario();

    await s.useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id });

    expect(s.assignmentRepo.deleted).toContain(s.assignment.id);
    expect(s.assignmentRepo.assignments).toHaveLength(0);
  });

  it('404 ao remover alocação inexistente (não idempotente)', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: 'nao-existe' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 ao remover alocação de outra instituição', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: 'i2', actor: ADMIN_GERAL, id: s.assignment.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(s.assignmentRepo.assignments).toHaveLength(1); // não removeu
  });

  it('403 quando o ator não administra o ministério da escala', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        id: s.assignment.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(s.assignmentRepo.assignments).toHaveLength(1); // não removeu
  });

  it('ADMIN_MINISTERIO com isAdmin no ministério da escala pode remover', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: 'am', ministryId: s.ministry.id, isAdmin: true }),
    );

    await s.useCase.execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      id: s.assignment.id,
    });
    expect(s.assignmentRepo.assignments).toHaveLength(0);
  });
});
