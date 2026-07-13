import { Assignment } from '../../../entities/Assignment';
import { Event } from '../../../entities/Event';
import { Member } from '../../../entities/Member';
import { Ministry } from '../../../entities/Ministry';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { Position } from '../../../entities/Position';
import { PositionCompatibility } from '../../../entities/PositionCompatibility';
import { Schedule } from '../../../entities/Schedule';
import { AssignmentDetail, AssignmentRepository, MemberAssignmentContext } from '../../../repositories/AssignmentRepository';
import { EventRepository, EventDateRange } from '../../../repositories/EventRepository';
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
import { PositionCompatibilityRepository } from '../../../repositories/PositionCompatibilityRepository';
import { PositionRepository } from '../../../repositories/PositionRepository';
import { ScheduleRepository } from '../../../repositories/ScheduleRepository';
import { Actor, MinistryAccessPolicy } from '../../../services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../../services/AssignmentEligibility';
import { ConflictDetectionService } from '../../../services/ConflictDetectionService';
import { CheckPositionCompatibilityUseCase } from '../../position-compatibilities/CheckPositionCompatibilityUseCase';
import { UpdateAssignmentUseCase, UpdateAssignmentResult } from '../UpdateAssignmentUseCase';

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

/** Fake do repo de compatibilidade — mesmo padrão de ConflictDetectionService.test.ts. */
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
  async delete(id1: string, id2: string): Promise<boolean> {
    const [a, b] = PositionCompatibility.orderPair(id1, id2);
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.positionAId === a && r.positionBId === b));
    return this.rows.length < before;
  }
  async listByInstitution(): Promise<PositionCompatibility[]> {
    return this.rows;
  }
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
  async existsByScheduleMemberPosition(
    scheduleId: string,
    memberId: string,
    positionId: string,
  ): Promise<boolean> {
    return this.assignments.some(
      (a) => a.scheduleId === scheduleId && a.memberId === memberId && a.positionId === positionId,
    );
  }
  async findByScheduleWithDetails(): Promise<AssignmentDetail[]> {
    return []; // não exercitado neste arquivo
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
const ADMIN_GERAL: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };

/** Extrai a alocação de um resultado 'applied'; falha o teste se vier 'needs_confirmation'. */
function expectApplied(result: UpdateAssignmentResult): Assignment {
  if (result.status !== 'applied') {
    throw new Error(`esperava status 'applied', recebeu '${result.status}'`);
  }
  return result.assignment;
}

/**
 * Instituição padrão: 1 ministério, 1 evento, 1 escala, 2 membros e 2 funções
 * pertencentes a ele (para poder trocar pessoa/função por outra válida), + 1
 * alocação inicial. O ConflictDetectionService é o REAL (com fakes por baixo).
 */
async function scenario() {
  const ministryRepo = new FakeMinistryRepository();
  const scheduleRepo = new FakeScheduleRepository();
  const eventRepo = new FakeEventRepository();
  const memberRepo = new FakeMemberRepository();
  const positionRepo = new FakePositionRepository();
  const membershipRepo = new FakeMembershipRepository();
  const compatibilityRepo = new FakeCompatibilityRepository();
  const assignmentRepo = new FakeAssignmentRepository(scheduleRepo, eventRepo, ministryRepo, memberRepo, positionRepo);
  const policy = new MinistryAccessPolicy(membershipRepo);
  const eligibility = new AssignmentEligibility(memberRepo, positionRepo, membershipRepo);
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
    eventRepo,
    eligibility,
    policy,
    conflictDetection,
  );

  return {
    ministryRepo, scheduleRepo, eventRepo, memberRepo, positionRepo, membershipRepo,
    compatibilityRepo, assignmentRepo, policy, eligibility, conflictDetection,
    ministry, event, schedule, member, member2, position, position2, assignment, useCase,
  };
}

describe('UpdateAssignmentUseCase', () => {
  it('troca a função da pessoa (mesma pessoa, nova função válida do ministério)', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: s.position2.id,
    });
    const updated = expectApplied(result);

    expect(updated.memberId).toBe(s.member.id);
    expect(updated.positionId).toBe(s.position2.id);
  });

  it('troca a pessoa da função (nova pessoa válida do ministério, mesma função)', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, memberId: s.member2.id,
    });
    const updated = expectApplied(result);

    expect(updated.memberId).toBe(s.member2.id);
    expect(updated.positionId).toBe(s.position.id);
  });

  it('troca ambos (pessoa e função)', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id,
      memberId: s.member2.id, positionId: s.position2.id,
    });
    const updated = expectApplied(result);

    expect(updated.memberId).toBe(s.member2.id);
    expect(updated.positionId).toBe(s.position2.id);
  });

  it('editar SEM gerar conflito: aplica com conflict=false', async () => {
    const s = await scenario();
    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: s.position2.id,
    });
    const updated = expectApplied(result);
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

  it('não colide consigo mesma quando nada muda (auto-exclusão via excludeAssignmentId)', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id,
      memberId: s.member.id, positionId: s.position.id,
    });
    const updated = expectApplied(result);

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

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      id: s.assignment.id,
      positionId: s.position2.id,
    });
    expect(expectApplied(result).positionId).toBe(s.position2.id);
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

describe('UpdateAssignmentUseCase — integração com o motor de conflito (RN01/RN03)', () => {
  it('editar gerando conflito, SEM confirmConflict: needs_confirmation, NÃO aplica, com os detalhes', async () => {
    const s = await scenario();
    // member já tem outra alocação nesta escala (position2); a edição para
    // position3 sobrepõe 100% (mesmo evento) e não há compatibilidade registrada.
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: s.position2.id }),
    );
    const position3 = Position.create({ name: 'Bateria', ministryId: s.ministry.id });
    await s.positionRepo.save(position3);

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: position3.id,
    });

    expect(result.status).toBe('needs_confirmation');
    if (result.status === 'needs_confirmation') {
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].positionId).toBe(s.position2.id);
      // nomes legíveis (incremento 3a) — o front monta a mensagem sem resolver ids.
      expect(result.conflicts[0].memberName).toBe(s.member.name);
      expect(result.conflicts[0].positionName).toBe(s.position2.name);
      expect(result.conflicts[0].ministryName).toBe(s.ministry.name);
    }
    // não aplicou: a alocação original continua com a função antiga.
    const stillOriginal = await s.assignmentRepo.findById(s.assignment.id);
    expect(stillOriginal!.positionId).toBe(s.position.id);
  });

  it('editar gerando conflito, COM confirmConflict=true: aplica com conflict=true', async () => {
    const s = await scenario();
    await s.assignmentRepo.save(
      Assignment.create({ scheduleId: s.schedule.id, memberId: s.member.id, positionId: s.position2.id }),
    );
    const position3 = Position.create({ name: 'Bateria', ministryId: s.ministry.id });
    await s.positionRepo.save(position3);

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: s.assignment.id, positionId: position3.id, confirmConflict: true,
    });
    const updated = expectApplied(result);

    expect(updated.positionId).toBe(position3.id);
    expect(updated.conflict).toBe(true);
  });

  it('editar uma alocação que ERA conflituosa (conflict=true) para valores que NÃO conflitam: recalcula para false', async () => {
    const s = await scenario();
    // Alocação própria de member2/position2 (não colide com a s.assignment
    // padrão, que já ocupa scheduleId+member+position) — simula que nasceu
    // conflituosa via confirmação ciente numa alocação anterior.
    const conflicting = Assignment.create({
      scheduleId: s.schedule.id, memberId: s.member2.id, positionId: s.position2.id, conflict: true,
    });
    await s.assignmentRepo.save(conflicting);

    // member2 não tem mais nenhuma outra alocação sobreposta: com
    // excludeAssignmentId, o motor não encontra conflito algum agora.
    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, id: conflicting.id, positionId: s.position2.id,
    });
    const updated = expectApplied(result);

    expect(updated.conflict).toBe(false); // conflito que some -> false
  });
});
