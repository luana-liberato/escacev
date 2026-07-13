import { Event } from '../../../entities/Event';
import { Ministry } from '../../../entities/Ministry';
import { Schedule } from '../../../entities/Schedule';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { Assignment } from '../../../entities/Assignment';
import { Member } from '../../../entities/Member';
import { Position } from '../../../entities/Position';
import { ScheduleRepository } from '../../../repositories/ScheduleRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import { EventRepository, EventDateRange } from '../../../repositories/EventRepository';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../../repositories/MinistryMembershipRepository';
import { AssignmentDetail, AssignmentRepository } from '../../../repositories/AssignmentRepository';
import { MinistryAccessPolicy, Actor } from '../../../services/MinistryAccessPolicy';
import { CreateScheduleUseCase } from '../CreateScheduleUseCase';
import { GetScheduleUseCase } from '../GetScheduleUseCase';
import { ListSchedulesUseCase } from '../ListSchedulesUseCase';
import { DeleteScheduleUseCase } from '../DeleteScheduleUseCase';

/**
 * Fake mínimo do AssignmentRepository — só o necessário para o
 * GetScheduleUseCase resolver as alocações da escala (join simulado em memória).
 */
class FakeAssignmentRepository implements AssignmentRepository {
  assignments: Assignment[] = [];
  members: Member[] = [];
  positions: Position[] = [];

  async findById(id: string): Promise<Assignment | null> {
    return this.assignments.find((a) => a.id === id) ?? null;
  }
  async findByScheduleWithDetails(scheduleId: string): Promise<AssignmentDetail[]> {
    return this.assignments
      .filter((a) => a.scheduleId === scheduleId)
      .map((assignment) => ({
        assignment,
        member: this.members.find((m) => m.id === assignment.memberId)!,
        position: this.positions.find((p) => p.id === assignment.positionId)!,
      }));
  }
  async save(assignment: Assignment): Promise<Assignment> {
    this.assignments.push(assignment);
    return assignment;
  }
  async update(assignment: Assignment): Promise<Assignment> {
    return assignment;
  }
  async delete(): Promise<void> {}
  async existsByScheduleMemberPosition(): Promise<boolean> {
    return false;
  }
}

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

/**
 * O tenant da Escala é derivado do ministério. O fake resolve a instituição de
 * cada escala consultando os ministérios compartilhados (mesmo comportamento do
 * relation filter do Prisma real). O use case já valida o tenant do filtro antes
 * de chamar findByEvent/findByMinistry.
 */
class FakeScheduleRepository implements ScheduleRepository {
  schedules: Schedule[] = [];
  deleted: string[] = [];
  constructor(private readonly ministryRepo: FakeMinistryRepository) {}

  private institutionOf(schedule: Schedule): string | undefined {
    return this.ministryRepo.ministries.find((m) => m.id === schedule.ministryId)?.institutionId;
  }
  async findById(id: string): Promise<Schedule | null> {
    return this.schedules.find((s) => s.id === id) ?? null;
  }
  async findByMinistryEventAndName(
    ministryId: string,
    eventId: string,
    name: string,
  ): Promise<Schedule | null> {
    // Case-insensitive, como o repositório real (mode: 'insensitive').
    return (
      this.schedules.find(
        (s) =>
          s.ministryId === ministryId &&
          s.eventId === eventId &&
          s.name.toLowerCase() === name.toLowerCase(),
      ) ?? null
    );
  }
  async findByMinistryAndEvent(ministryId: string, eventId: string): Promise<Schedule[]> {
    return this.schedules.filter((s) => s.ministryId === ministryId && s.eventId === eventId);
  }
  async findByEvent(eventId: string, institutionId: string): Promise<Schedule[]> {
    return this.schedules.filter(
      (s) => s.eventId === eventId && this.institutionOf(s) === institutionId,
    );
  }
  async findByMinistry(ministryId: string, institutionId: string): Promise<Schedule[]> {
    return this.schedules.filter(
      (s) => s.ministryId === ministryId && this.institutionOf(s) === institutionId,
    );
  }
  async findByInstitution(institutionId: string): Promise<Schedule[]> {
    return this.schedules.filter((s) => this.institutionOf(s) === institutionId);
  }
  async save(s: Schedule): Promise<Schedule> {
    this.schedules.push(s);
    return s;
  }
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.schedules = this.schedules.filter((s) => s.id !== id);
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

const INST = 'i1';
const ADMIN_GERAL: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };

const d = (s: string) => new Date(s);

/** Instituição padrão com um ministério e um evento. */
async function scenario() {
  const ministryRepo = new FakeMinistryRepository();
  const eventRepo = new FakeEventRepository();
  const scheduleRepo = new FakeScheduleRepository(ministryRepo);
  const membershipRepo = new FakeMembershipRepository();
  const policy = new MinistryAccessPolicy(membershipRepo);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);
  const event = Event.create({
    institutionId: INST,
    name: 'Culto',
    type: 'SERVICE',
    startsAt: d('2026-07-12T18:00:00Z'),
    endsAt: d('2026-07-12T20:00:00Z'),
  });
  await eventRepo.save(event);

  return { ministryRepo, eventRepo, scheduleRepo, membershipRepo, policy, ministry, event };
}

describe('CreateScheduleUseCase', () => {
  function build(s: Awaited<ReturnType<typeof scenario>>) {
    return new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy);
  }

  it('ADMIN_GERAL cria a escala vazia (status RASCUNHO, publishedAt null)', async () => {
    const s = await scenario();
    const schedule = await build(s).execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      eventId: s.event.id,
    });

    expect(schedule.id).toBeTruthy();
    expect(schedule.status).toBe('RASCUNHO');
    expect(schedule.publishedAt).toBeNull();
    expect(s.scheduleRepo.schedules).toHaveLength(1);
  });

  it('ADMIN_MINISTERIO com isAdmin naquele ministério cria a escala', async () => {
    const s = await scenario();
    s.membershipRepo.memberships.push(
      MinistryMembership.create({ memberId: 'am', ministryId: s.ministry.id, isAdmin: true }),
    );
    const schedule = await build(s).execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      ministryId: s.ministry.id,
      eventId: s.event.id,
    });
    expect(schedule.status).toBe('RASCUNHO');
  });

  it('409 para duplicata da escala padrão (mesmo ministério + evento, sem nome)', async () => {
    const s = await scenario();
    const useCase = build(s);
    const dto = { institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id };
    await useCase.execute(dto);

    // o segundo "" no mesmo ministério+evento colide (invariante do caso comum)
    await expect(useCase.execute(dto)).rejects.toMatchObject({ statusCode: 409 });
    expect(s.scheduleRepo.schedules).toHaveLength(1);
  });

  it('cria várias escalas NOMEADAS para o mesmo ministério+evento (salas), sem 409', async () => {
    const s = await scenario();
    const useCase = build(s);
    const common = { institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id };

    const bercario = await useCase.execute({ ...common, name: 'Berçário' });
    const sala1 = await useCase.execute({ ...common, name: 'Sala 1' });

    expect(bercario.name).toBe('Berçário');
    expect(sala1.name).toBe('Sala 1');
    expect(s.scheduleRepo.schedules).toHaveLength(2);
  });

  it('409 ao repetir o MESMO nome no mesmo ministério+evento', async () => {
    const s = await scenario();
    const useCase = build(s);
    const dto = { institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id, name: 'Sala 1' };
    await useCase.execute(dto);

    await expect(useCase.execute(dto)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Sala 1'),
    });
    expect(s.scheduleRepo.schedules).toHaveLength(1);
  });

  it('409 para nome duplicado com caixa diferente ("6 e 7" vs "6 E 7")', async () => {
    const s = await scenario();
    const useCase = build(s);
    const common = { institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id };
    await useCase.execute({ ...common, name: '6 e 7' });

    await expect(useCase.execute({ ...common, name: '6 E 7' })).rejects.toMatchObject({ statusCode: 409 });
    expect(s.scheduleRepo.schedules).toHaveLength(1);
  });

  it('403 quando ADMIN_MINISTERIO não administra aquele ministério (guarda escopada)', async () => {
    const s = await scenario();
    await expect(
      build(s).execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        ministryId: s.ministry.id,
        eventId: s.event.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404 quando o ministério é de outra instituição', async () => {
    const s = await scenario();
    await expect(
      build(s).execute({ institutionId: 'i2', actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id }),
    ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining('Ministério') });
  });

  it('404 quando o evento é de outra instituição', async () => {
    const s = await scenario();
    const foreignEvent = Event.create({
      institutionId: 'i2', name: 'Alheio', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });
    await s.eventRepo.save(foreignEvent);

    await expect(
      build(s).execute({ institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: foreignEvent.id }),
    ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining('Evento') });
  });
});

describe('GetScheduleUseCase', () => {
  it('retorna a escala do próprio tenant, sem alocações (array vazio)', async () => {
    const s = await scenario();
    const created = await new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy).execute({
      institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id,
    });
    const assignmentRepo = new FakeAssignmentRepository();

    const result = await new GetScheduleUseCase(s.scheduleRepo, s.ministryRepo, assignmentRepo).execute({
      institutionId: INST, id: created.id,
    });
    expect(result.schedule.id).toBe(created.id);
    expect(result.assignments).toEqual([]);
  });

  it('retorna as alocações da escala já com membro e função resolvidos', async () => {
    const s = await scenario();
    const created = await new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy).execute({
      institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id,
    });
    const assignmentRepo = new FakeAssignmentRepository();
    const member = Member.create({ institutionId: INST, name: 'João', email: 'joao@example.com' });
    const position = Position.create({ name: 'Vocal', ministryId: s.ministry.id });
    assignmentRepo.members.push(member);
    assignmentRepo.positions.push(position);
    await assignmentRepo.save(
      Assignment.create({ scheduleId: created.id, memberId: member.id, positionId: position.id }),
    );

    const result = await new GetScheduleUseCase(s.scheduleRepo, s.ministryRepo, assignmentRepo).execute({
      institutionId: INST, id: created.id,
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].member.name).toBe('João');
    expect(result.assignments[0].position.name).toBe('Vocal');
  });

  it('404 quando a escala é de outra instituição', async () => {
    const s = await scenario();
    const created = await new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy).execute({
      institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id,
    });

    await expect(
      new GetScheduleUseCase(s.scheduleRepo, s.ministryRepo, new FakeAssignmentRepository()).execute({
        institutionId: 'i2', id: created.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 quando o id não existe', async () => {
    const s = await scenario();
    await expect(
      new GetScheduleUseCase(s.scheduleRepo, s.ministryRepo, new FakeAssignmentRepository()).execute({
        institutionId: INST, id: 'nao-existe',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ListSchedulesUseCase', () => {
  /** Cria um 2º ministério + escala no mesmo evento, para a visão do evento. */
  async function withTwoMinistriesOnSameEvent() {
    const s = await scenario();
    const create = new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy);
    await create.execute({ institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id });

    const ministryB = Ministry.create({ institutionId: INST, name: 'Mídia' });
    await s.ministryRepo.save(ministryB);
    await create.execute({ institutionId: INST, actor: ADMIN_GERAL, ministryId: ministryB.id, eventId: s.event.id });

    return { s, ministryB };
  }

  it('por evento: retorna as escalas de todos os ministérios daquele evento', async () => {
    const { s } = await withTwoMinistriesOnSameEvent();
    const list = await new ListSchedulesUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo).execute({
      institutionId: INST, eventId: s.event.id,
    });
    expect(list).toHaveLength(2);
  });

  it('por ministério: retorna só as escalas daquele ministério', async () => {
    const { s } = await withTwoMinistriesOnSameEvent();
    const list = await new ListSchedulesUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo).execute({
      institutionId: INST, ministryId: s.ministry.id,
    });
    expect(list).toHaveLength(1);
    expect(list[0].ministryId).toBe(s.ministry.id);
  });

  it('ambos os filtros: retorna TODAS as salas daquele ministério naquele evento', async () => {
    const s = await scenario();
    const create = new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy);
    const common = { institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id };
    await create.execute({ ...common, name: 'Berçário' });
    await create.execute({ ...common, name: 'Sala 1' });

    const list = await new ListSchedulesUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo).execute({
      institutionId: INST, eventId: s.event.id, ministryId: s.ministry.id,
    });
    expect(list.map((x) => x.name).sort()).toEqual(['Berçário', 'Sala 1']);
  });

  it('sem filtro: retorna todas as escalas da instituição', async () => {
    const { s } = await withTwoMinistriesOnSameEvent();
    const list = await new ListSchedulesUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo).execute({
      institutionId: INST,
    });
    expect(list).toHaveLength(2);
  });

  it('404 ao filtrar por evento de outra instituição', async () => {
    const s = await scenario();
    const foreignEvent = Event.create({
      institutionId: 'i2', name: 'Alheio', type: 'SERVICE',
      startsAt: d('2026-07-12T18:00:00Z'), endsAt: d('2026-07-12T20:00:00Z'),
    });
    await s.eventRepo.save(foreignEvent);

    await expect(
      new ListSchedulesUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo).execute({
        institutionId: INST, eventId: foreignEvent.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DeleteScheduleUseCase', () => {
  async function createdSchedule(s: Awaited<ReturnType<typeof scenario>>) {
    return new CreateScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.eventRepo, s.policy).execute({
      institutionId: INST, actor: ADMIN_GERAL, ministryId: s.ministry.id, eventId: s.event.id,
    });
  }

  it('ADMIN_GERAL remove a escala', async () => {
    const s = await scenario();
    const schedule = await createdSchedule(s);

    await new DeleteScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.policy).execute({
      institutionId: INST, actor: ADMIN_GERAL, id: schedule.id,
    });
    expect(s.scheduleRepo.deleted).toContain(schedule.id);
    expect(s.scheduleRepo.schedules).toHaveLength(0);
  });

  it('403 quando o ator não administra o ministério da escala', async () => {
    const s = await scenario();
    const schedule = await createdSchedule(s);

    await expect(
      new DeleteScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.policy).execute({
        institutionId: INST, actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' }, id: schedule.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(s.scheduleRepo.schedules).toHaveLength(1);
  });

  it('404 ao remover escala de outra instituição', async () => {
    const s = await scenario();
    const schedule = await createdSchedule(s);

    await expect(
      new DeleteScheduleUseCase(s.scheduleRepo, s.ministryRepo, s.policy).execute({
        institutionId: 'i2', actor: ADMIN_GERAL, id: schedule.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
