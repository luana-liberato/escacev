import { Assignment } from '../../../entities/Assignment';
import { Event } from '../../../entities/Event';
import { Member } from '../../../entities/Member';
import { Ministry } from '../../../entities/Ministry';
import { Position } from '../../../entities/Position';
import { PositionCompatibility } from '../../../entities/PositionCompatibility';
import { Schedule } from '../../../entities/Schedule';
import {
  AssignmentDetail,
  AssignmentRepository,
  MemberAssignmentContext,
} from '../../../repositories/AssignmentRepository';
import { EventRepository, EventDateRange } from '../../../repositories/EventRepository';
import { MemberRepository } from '../../../repositories/MemberRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import { PositionCompatibilityRepository } from '../../../repositories/PositionCompatibilityRepository';
import { PositionRepository } from '../../../repositories/PositionRepository';
import { ScheduleRepository } from '../../../repositories/ScheduleRepository';
import { ConflictDetectionService } from '../../../services/ConflictDetectionService';
import { CheckPositionCompatibilityUseCase } from '../../position-compatibilities/CheckPositionCompatibilityUseCase';
import { GetScheduleConflictsUseCase } from '../GetScheduleConflictsUseCase';

const d = (s: string) => new Date(s);

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

class FakeEventRepository implements EventRepository {
  events: Event[] = [];
  async findById(id: string): Promise<Event | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }
  async findByInstitution(institutionId: string, _range?: EventDateRange): Promise<Event[]> {
    return this.events.filter((e) => e.institutionId === institutionId);
  }
  async save(e: Event): Promise<Event> {
    this.events.push(e);
    return e;
  }
  async update(e: Event): Promise<Event> {
    return e;
  }
  async delete(): Promise<void> {}
  async countSchedules(): Promise<number> {
    return 0;
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
  async update(s: Schedule): Promise<Schedule> {
    this.schedules = this.schedules.map((x) => (x.id === s.id ? s : x));
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

/** Fake do repo de compatibilidade — matriz vazia = todo par sobreposto é incompatível. */
class FakeCompatibilityRepository implements PositionCompatibilityRepository {
  rows: PositionCompatibility[] = [];
  async findByPair(id1: string, id2: string): Promise<PositionCompatibility | null> {
    const [a, b] = PositionCompatibility.orderPair(id1, id2);
    return this.rows.find((r) => r.positionAId === a && r.positionBId === b) ?? null;
  }
  async save(compatibility: PositionCompatibility): Promise<PositionCompatibility> {
    this.rows.push(compatibility);
    return compatibility;
  }
  async delete(): Promise<boolean> {
    return false;
  }
  async listByInstitution(): Promise<PositionCompatibility[]> {
    return this.rows;
  }
}

/**
 * Fake do AssignmentRepository que resolve tanto o join da escala
 * (findByScheduleWithDetails) quanto o contexto do membro
 * (findByMemberWithContext) a partir dos repos vizinhos — é o suficiente para
 * exercitar o GetScheduleConflictsUseCase com o ConflictDetectionService REAL
 * (não mockado), sem reimplementar a regra RN01.
 */
class FakeAssignmentRepository implements AssignmentRepository {
  assignments: Assignment[] = [];

  constructor(
    private readonly scheduleRepo: FakeScheduleRepository,
    private readonly eventRepo: FakeEventRepository,
    private readonly ministryRepo: FakeMinistryRepository,
    private readonly memberRepo: FakeMemberRepository,
    private readonly positionRepo: FakePositionRepository,
  ) {}

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
  async existsByScheduleMemberPosition(): Promise<boolean> {
    return false;
  }
  async findByScheduleWithDetails(scheduleId: string): Promise<AssignmentDetail[]> {
    return this.assignments
      .filter((a) => a.scheduleId === scheduleId)
      .map((assignment) => ({
        assignment,
        member: this.memberRepo.members.find((m) => m.id === assignment.memberId)!,
        position: this.positionRepo.positions.find((p) => p.id === assignment.positionId)!,
      }));
  }
  async findByMemberWithContext(memberId: string): Promise<MemberAssignmentContext[]> {
    return this.assignments
      .filter((a) => a.memberId === memberId)
      .map((a) => {
        const schedule = this.scheduleRepo.schedules.find((s) => s.id === a.scheduleId)!;
        const event = this.eventRepo.events.find((e) => e.id === schedule.eventId)!;
        const ministry = this.ministryRepo.ministries.find((m) => m.id === schedule.ministryId)!;
        const member = this.memberRepo.members.find((m) => m.id === a.memberId)!;
        const position = this.positionRepo.positions.find((p) => p.id === a.positionId)!;
        return {
          assignmentId: a.id,
          memberName: member.name,
          scheduleId: a.scheduleId,
          ministryId: schedule.ministryId,
          ministryName: ministry.name,
          eventId: schedule.eventId,
          eventName: event.name,
          positionId: a.positionId,
          positionName: position.name,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
        };
      });
  }
}

const INST = 'i1';

/**
 * Instituição padrão: 1 ministério, 1 evento, 1 escala e 1 membro vinculado.
 * O ConflictDetectionService é o REAL (com fakes por baixo).
 */
async function scenario() {
  const ministryRepo = new FakeMinistryRepository();
  const scheduleRepo = new FakeScheduleRepository();
  const eventRepo = new FakeEventRepository();
  const memberRepo = new FakeMemberRepository();
  const positionRepo = new FakePositionRepository();
  const compatibilityRepo = new FakeCompatibilityRepository();
  const assignmentRepo = new FakeAssignmentRepository(
    scheduleRepo,
    eventRepo,
    ministryRepo,
    memberRepo,
    positionRepo,
  );
  const checkCompatibility = new CheckPositionCompatibilityUseCase(compatibilityRepo);
  const conflictDetection = new ConflictDetectionService(assignmentRepo, checkCompatibility);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);
  const event = Event.create({
    institutionId: INST,
    name: 'Culto de Domingo',
    type: 'SERVICE',
    startsAt: d('2026-07-12T18:00:00Z'),
    endsAt: d('2026-07-12T20:00:00Z'),
  });
  await eventRepo.save(event);
  const schedule = Schedule.create({ ministryId: ministry.id, eventId: event.id });
  await scheduleRepo.save(schedule);
  const member = Member.create({ institutionId: INST, name: 'João', email: 'joao@example.com' });
  await memberRepo.save(member);

  const useCase = new GetScheduleConflictsUseCase(
    scheduleRepo,
    ministryRepo,
    eventRepo,
    assignmentRepo,
    conflictDetection,
  );

  return {
    ministryRepo, scheduleRepo, eventRepo, memberRepo, positionRepo, compatibilityRepo,
    assignmentRepo, conflictDetection, ministry, event, schedule, member, useCase,
  };
}

describe('GetScheduleConflictsUseCase', () => {
  it('escala sem alocações: conflicts vazio', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({ institutionId: INST, id: s.schedule.id });

    expect(result.schedule.id).toBe(s.schedule.id);
    expect(result.conflicts).toEqual([]);
  });

  it('uma única alocação: não conflita consigo mesma (excludeAssignmentId)', async () => {
    const s = await scenario();
    const vocal = Position.create({ name: 'Vocal', ministryId: s.ministry.id });
    await s.positionRepo.save(vocal);
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: vocal.id }),
    );

    const result = await s.useCase.execute({ institutionId: INST, id: s.schedule.id });

    expect(result.conflicts).toEqual([]);
  });

  it('duas funções incompatíveis do mesmo membro na escala: ambas em conflito', async () => {
    const s = await scenario();
    const vocal = Position.create({ name: 'Vocal', ministryId: s.ministry.id });
    const guitar = Position.create({ name: 'Violão', ministryId: s.ministry.id });
    await s.positionRepo.save(vocal);
    await s.positionRepo.save(guitar);
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: vocal.id }),
    );
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: guitar.id }),
    );

    const result = await s.useCase.execute({ institutionId: INST, id: s.schedule.id });

    expect(result.conflicts).toHaveLength(2);
    // Cada alocação aponta a OUTRA como conflitante (com nomes legíveis, 3a).
    const vocalEntry = result.conflicts.find((c) => c.position.id === vocal.id)!;
    expect(vocalEntry.member.name).toBe('João');
    expect(vocalEntry.conflicts).toHaveLength(1);
    expect(vocalEntry.conflicts[0].positionId).toBe(guitar.id);
    expect(vocalEntry.conflicts[0].positionName).toBe('Violão');
  });

  it('funções COMPATÍVEIS do mesmo membro: sem conflito', async () => {
    const s = await scenario();
    const vocal = Position.create({ name: 'Vocal', ministryId: s.ministry.id });
    const backing = Position.create({ name: 'Backing', ministryId: s.ministry.id });
    await s.positionRepo.save(vocal);
    await s.positionRepo.save(backing);
    await s.compatibilityRepo.save(
      PositionCompatibility.create({ positionAId: vocal.id, positionBId: backing.id }),
    );
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: vocal.id }),
    );
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: backing.id }),
    );

    const result = await s.useCase.execute({ institutionId: INST, id: s.schedule.id });

    expect(result.conflicts).toEqual([]);
  });

  it('conflito CROSS-MINISTÉRIO: alocação em outra escala/evento sobreposto aparece nos detalhes', async () => {
    const s = await scenario();
    const vocal = Position.create({ name: 'Vocal', ministryId: s.ministry.id });
    await s.positionRepo.save(vocal);
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: vocal.id }),
    );

    // Outro ministério, outro evento sobreposto no horário, função incompatível.
    const otherMinistry = Ministry.create({ institutionId: INST, name: 'Mídia' });
    await s.ministryRepo.save(otherMinistry);
    const overlappingEvent = Event.create({
      institutionId: INST,
      name: 'Transmissão',
      type: 'SERVICE',
      startsAt: d('2026-07-12T19:00:00Z'),
      endsAt: d('2026-07-12T21:00:00Z'),
    });
    await s.eventRepo.save(overlappingEvent);
    const otherSchedule = Schedule.create({ ministryId: otherMinistry.id, eventId: overlappingEvent.id });
    await s.scheduleRepo.save(otherSchedule);
    const camera = Position.create({ name: 'Câmera', ministryId: otherMinistry.id });
    await s.positionRepo.save(camera);
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: otherSchedule.id, memberId: s.member.id, positionId: camera.id }),
    );

    const result = await s.useCase.execute({ institutionId: INST, id: s.schedule.id });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].position.id).toBe(vocal.id);
    expect(result.conflicts[0].conflicts).toHaveLength(1);
    expect(result.conflicts[0].conflicts[0].ministryName).toBe('Mídia');
    expect(result.conflicts[0].conflicts[0].eventName).toBe('Transmissão');
  });

  it('404 quando a escala é de outra instituição', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: 'i2', id: s.schedule.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 quando o id da escala não existe', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({ institutionId: INST, id: 'nao-existe' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
