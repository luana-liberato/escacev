import { Assignment } from '../../../entities/Assignment';
import { Member } from '../../../entities/Member';
import { Ministry } from '../../../entities/Ministry';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { Position } from '../../../entities/Position';
import { Schedule } from '../../../entities/Schedule';
import { AssignmentRepository } from '../../../repositories/AssignmentRepository';
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
import { PositionRepository } from '../../../repositories/PositionRepository';
import { ScheduleRepository } from '../../../repositories/ScheduleRepository';
import { Actor, MinistryAccessPolicy } from '../../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../../services/AssignmentEligibility';
import { UpdateAssignmentUseCase } from '../UpdateAssignmentUseCase';

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
  async findByInstitution(): Promise<Member[]> {
    return [];
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

class FakePositionRepository implements PositionRepository {
  positions: Position[] = [];
  async findById(id: string): Promise<Position | null> {
    return this.positions.find((p) => p.id === id) ?? null;
  }
  async findByMinistry(ministryId: string): Promise<Position[]> {
    return this.positions.filter((p) => p.ministryId === ministryId);
  }
  async findByNameInMinistry(): Promise<Position | null> {
    return null;
  }
  async save(p: Position): Promise<Position> {
    this.positions.push(p);
    return p;
  }
  async update(p: Position): Promise<Position> {
    return p;
  }
  async delete(): Promise<void> {}
  async countEventSlotUsage(): Promise<number> {
    return 0;
  }
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
  async findById(id: string): Promise<Assignment | null> {
    return this.assignments.find((a) => a.id === id) ?? null;
  }
  async save(assignment: Assignment): Promise<Assignment> {
    this.assignments.push(assignment);
    return assignment;
  }
  async update(assignment: Assignment): Promise<Assignment> {
    this.assignments = this.assignments.map((a) => (a.id === assignment.id ? assignment : a));
    return assignment;
  }
  async delete(id: string): Promise<void> {
    this.assignments = this.assignments.filter((a) => a.id !== id);
  }
  async existsByScheduleMemberPosition(
    scheduleId: string,
    memberId: string,
    positionId: string,
  ): Promise<boolean> {
    return this.assignments.some(
      (a) => a.scheduleId === scheduleId && a.memberId === memberId && a.positionId === positionId,
    );
  }
}

const INST = 'i1';
const ADMIN_GERAL: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };

/**
 * Instituição padrão: 1 ministério, 1 escala, 2 membros e 2 funções pertencentes
 * a ele (para poder trocar pessoa/função por outra válida), + 1 alocação inicial.
 */
async function scenario() {
  const ministryRepo = new FakeMinistryRepository();
  const scheduleRepo = new FakeScheduleRepository();
  const memberRepo = new FakeMemberRepository();
  const positionRepo = new FakePositionRepository();
  const membershipRepo = new FakeMembershipRepository();
  const assignmentRepo = new FakeAssignmentRepository();
  const policy = new MinistryAccessPolicy(membershipRepo);
  const eligibility = new AssignmentEligibility(memberRepo, positionRepo, membershipRepo);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);
  const schedule = Schedule.create({ ministryId: ministry.id, eventId: 'ev1' });
  await scheduleRepo.save(schedule);

  const member = Member.create({ institutionId: INST, name: 'João', email: 'joao@example.com' });
  await memberRepo.save(member);
  await membershipRepo.save(MinistryMembership.create({ memberId: member.id, ministryId: ministry.id }));
  const member2 = Member.create({ institutionId: INST, name: 'Maria', email: 'maria@example.com' });
  await memberRepo.save(member2);
  await membershipRepo.save(MinistryMembership.create({ memberId: member2.id, ministryId: ministry.id }));

  const position = Position.create({ name: 'Vocal', ministryId: ministry.id });
  await positionRepo.save(position);
  const position2 = Position.create({ name: 'Violão', ministryId: ministry.id });
  await positionRepo.save(position2);

  const assignment = Assignment.create({ scheduleId: schedule.id, memberId: member.id, positionId: position.id });
  await assignmentRepo.save(assignment);

  const useCase = new UpdateAssignmentUseCase(
    assignmentRepo,
    scheduleRepo,
    ministryRepo,
    eligibility,
    policy,
  );

  return {
    ministryRepo, scheduleRepo, memberRepo, positionRepo, membershipRepo, assignmentRepo,
    ministry, schedule, member, member2, position, position2, assignment, useCase,
  };
}

describe('UpdateAssignmentUseCase', () => {
  it('troca a função da pessoa (mesma pessoa, nova função válida do ministério)', async () => {
    const s = await scenario();

    const updated = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: s.position2.id,
    });

    expect(updated.memberId).toBe(s.member.id);
    expect(updated.positionId).toBe(s.position2.id);
  });

  it('troca a pessoa da função (nova pessoa válida do ministério, mesma função)', async () => {
    const s = await scenario();

    const updated = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, memberId: s.member2.id,
    });

    expect(updated.memberId).toBe(s.member2.id);
    expect(updated.positionId).toBe(s.position.id);
  });

  it('troca ambos (pessoa e função)', async () => {
    const s = await scenario();

    const updated = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id,
      memberId: s.member2.id, positionId: s.position2.id,
    });

    expect(updated.memberId).toBe(s.member2.id);
    expect(updated.positionId).toBe(s.position2.id);
  });

  it('conflict permanece inalterado após a edição', async () => {
    const s = await scenario();
    const updated = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: s.position2.id,
    });
    expect(updated.conflict).toBe(false);
  });

  it('rejeita quando o novo membro NÃO é do ministério da escala', async () => {
    const s = await scenario();
    const outsider = Member.create({ institutionId: INST, name: 'Fora', email: 'fora@example.com' });
    await s.memberRepo.save(outsider);

    await expect(
      s.useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, memberId: outsider.id }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Membro não pertence a este ministério' });
  });

  it('rejeita quando a nova função NÃO é do ministério da escala', async () => {
    const s = await scenario();
    const otherMinistry = Ministry.create({ institutionId: INST, name: 'Mídia' });
    await s.ministryRepo.save(otherMinistry);
    const foreignPosition = Position.create({ name: 'Câmera', ministryId: otherMinistry.id });
    await s.positionRepo.save(foreignPosition);

    await expect(
      s.useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: foreignPosition.id }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Função não pertence a este ministério' });
  });

  it('rejeita edição que resultaria em duplicata (já existe alocação igual na escala)', async () => {
    const s = await scenario();
    // Outra alocação já ocupa (member2, position2) na mesma escala.
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member2.id, positionId: s.position2.id }),
    );

    await expect(
      s.useCase.execute({
        institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id,
        memberId: s.member2.id, positionId: s.position2.id,
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Esta pessoa já está alocada nesta função nesta escala' });
  });

  it('não colide consigo mesma quando nada muda (mesmo par)', async () => {
    const s = await scenario();

    const updated = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id,
      memberId: s.member.id, positionId: s.position.id,
    });

    expect(updated.memberId).toBe(s.member.id);
    expect(updated.positionId).toBe(s.position.id);
  });

  it('400 quando nem memberId nem positionId são informados', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('403 quando o ator não administra o ministério da escala', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        id: s.assignment.id,
        positionId: s.position2.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('ADMIN_MINISTERIO com isAdmin no ministério da escala pode editar', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: 'am', ministryId: s.ministry.id, isAdmin: true }),
    );

    const updated = await s.useCase.execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      id: s.assignment.id,
      positionId: s.position2.id,
    });
    expect(updated.positionId).toBe(s.position2.id);
  });

  it('404 quando a alocação não existe', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: 'nao-existe', positionId: s.position2.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 quando a alocação é de outra instituição', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: 'i2', actor: ADMIN_GERAL, id: s.assignment.id, positionId: s.position2.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
