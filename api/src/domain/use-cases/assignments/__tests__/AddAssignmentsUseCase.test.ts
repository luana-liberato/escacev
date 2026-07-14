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
import { AddAssignmentsUseCase } from '../AddAssignmentsUseCase';

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
  async update(s: Schedule): Promise<Schedule> {
    this.schedules = this.schedules.map((x) => (x.id === s.id ? s : x));
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
  /** Quando setado, o próximo save() lança — simula a corrida do @@unique. */
  throwOnNextSave = false;

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
    if (this.throwOnNextSave) {
      this.throwOnNextSave = false;
      throw new Error('Unique constraint failed (simulado)');
    }
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
    return []; // não exercitado neste arquivo (ver GetScheduleUseCase)
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

/**
 * Instituição padrão: 1 ministério, 1 evento, 1 escala, 1 membro e 1 função
 * pertencentes a ele. O ConflictDetectionService é o REAL (com fakes por
 * baixo) — não é mockado, para não reimplementar/mascarar a regra RN01.
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
  await membershipRepo.save(
    MinistryMembership.create({ memberId: member.id, ministryId: ministry.id }),
  );
  const position = Position.create({ name: 'Vocal', ministryId: ministry.id });
  await positionRepo.save(position);

  const useCase = new AddAssignmentsUseCase(
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
    ministry, event, schedule, member, position, useCase,
  };
}

describe('AddAssignmentsUseCase', () => {
  it('adiciona um item válido: created com o item, failed vazio, conflict=false', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: s.position.id }],
    });

    expect(result.created).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(result.created[0].conflict).toBe(false);
    expect(result.created[0].scheduleId).toBe(s.schedule.id);
  });

  it('lote misto: válidos entram em created; inválidos em failed com o motivo certo', async () => {
    const s = await scenario();

    // Segundo membro válido do mesmo ministério, para ter 2 sucessos no lote.
    const member2 = Member.create({ institutionId: INST, name: 'Maria', email: 'maria@example.com' });
    await s.memberRepo.save(member2);
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: member2.id, ministryId: s.ministry.id }),
    );

    // Membro de fora do ministério (existe, mas sem vínculo).
    const outsider = Member.create({ institutionId: INST, name: 'Fora', email: 'fora@example.com' });
    await s.memberRepo.save(outsider);

    // Função de outro ministério.
    const otherMinistry = Ministry.create({ institutionId: INST, name: 'Mídia' });
    await s.ministryRepo.save(otherMinistry);
    const foreignPosition = Position.create({ name: 'Câmera', ministryId: otherMinistry.id });
    await s.positionRepo.save(foreignPosition);

    // Já alocado antes (duplicata via banco).
    await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: s.position.id }],
    });

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      scheduleId: s.schedule.id,
      items: [
        { memberId: member2.id, positionId: s.position.id }, // válido
        { memberId: outsider.id, positionId: s.position.id }, // fora do ministério
        { memberId: s.member.id, positionId: foreignPosition.id }, // função de outro ministério
        { memberId: s.member.id, positionId: s.position.id }, // já alocado (duplicata no banco)
      ],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].memberId).toBe(member2.id);

    expect(result.failed).toHaveLength(3);
    expect(result.failed.find((f) => f.item.memberId === outsider.id)?.reason).toBe(
      'Membro não pertence a este ministério',
    );
    expect(result.failed.find((f) => f.item.positionId === foreignPosition.id)?.reason).toBe(
      'Função não pertence a este ministério',
    );
    expect(
      result.failed.find((f) => f.item.memberId === s.member.id && f.item.positionId === s.position.id)
        ?.reason,
    ).toBe('Esta pessoa já está alocada nesta função nesta escala');
  });

  it('duplicata DENTRO do mesmo lote: primeira entra, segunda falha', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      scheduleId: s.schedule.id,
      items: [
        { memberId: s.member.id, positionId: s.position.id },
        { memberId: s.member.id, positionId: s.position.id },
      ],
    });

    expect(result.created).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toBe('Esta pessoa já está alocada nesta função nesta escala');
  });

  it('membro inexistente: falha com "Membro não encontrado"', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: 'nao-existe', positionId: s.position.id }],
    });

    expect(result.failed[0].reason).toBe('Membro não encontrado');
  });

  it('função inexistente: falha com "Função não encontrada"', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: 'nao-existe' }],
    });

    expect(result.failed[0].reason).toBe('Função não encontrada');
  });

  it('backstop de corrida: save() lança para um item já validado -> failed, sem afetar os anteriores', async () => {
    const s = await scenario();
    const member2 = Member.create({ institutionId: INST, name: 'Maria', email: 'maria@example.com' });
    await s.memberRepo.save(member2);
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: member2.id, ministryId: s.ministry.id }),
    );

    s.assignmentRepo.throwOnNextSave = true; // afeta só o PRIMEIRO save() chamado

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      scheduleId: s.schedule.id,
      items: [
        { memberId: s.member.id, positionId: s.position.id }, // vai falhar no save (simulado)
        { memberId: member2.id, positionId: s.position.id }, // deve ser salvo normalmente
      ],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].memberId).toBe(member2.id);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].item.memberId).toBe(s.member.id);
    expect(result.failed[0].reason).toBe('Esta pessoa já está alocada nesta função nesta escala');
  });

  it('403 quando o ator não administra o ministério da escala (nenhum item processado)', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        scheduleId: s.schedule.id,
        items: [{ memberId: s.member.id, positionId: s.position.id }],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(s.assignmentRepo.assignments).toHaveLength(0);
  });

  it('ADMIN_MINISTERIO com isAdmin no ministério da escala pode adicionar', async () => {
    const s = await scenario();
    await s.membershipRepo.save(
      MinistryMembership.create({ memberId: 'am', ministryId: s.ministry.id, isAdmin: true }),
    );

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: s.position.id }],
    });

    expect(result.created).toHaveLength(1);
  });

  it('404 quando a escala é de outra instituição (nenhum item processado)', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({
        institutionId: 'i2',
        actor: ADMIN_GERAL,
        scheduleId: s.schedule.id,
        items: [{ memberId: s.member.id, positionId: s.position.id }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(s.assignmentRepo.assignments).toHaveLength(0);
  });

  it('404 quando o id da escala não existe', async () => {
    const s = await scenario();

    await expect(
      s.useCase.execute({
        institutionId: INST, actor: ADMIN_GERAL, scheduleId: 'nao-existe',
        items: [{ memberId: s.member.id, positionId: s.position.id }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AddAssignmentsUseCase — integração com o motor de conflito (RN01/RN03)', () => {
  it('sem conflito: created com conflict=false (motor rodou e não achou nada)', async () => {
    const s = await scenario();

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: s.position.id }],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].conflict).toBe(false);
    expect(result.needsConfirmation).toHaveLength(0);
  });

  it('conflito SEM confirmConflict: needsConfirmation, NÃO cria, com os detalhes do conflito', async () => {
    const s = await scenario();
    // Primeira alocação do membro nesta escala — sem conflito.
    await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: s.position.id }],
    });
    // Segunda função, MESMA escala (mesmo evento -> sobreposição total); sem
    // compatibilidade registrada entre Vocal e Violão -> conflito.
    const guitar = Position.create({ name: 'Violão', ministryId: s.ministry.id });
    await s.positionRepo.save(guitar);

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: guitar.id }],
    });

    expect(result.created).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.needsConfirmation).toHaveLength(1);
    expect(result.needsConfirmation[0].item.positionId).toBe(guitar.id);
    expect(result.needsConfirmation[0].conflicts).toHaveLength(1);
    expect(result.needsConfirmation[0].conflicts[0].positionId).toBe(s.position.id);
    expect(s.assignmentRepo.assignments).toHaveLength(1); // só a primeira; a segunda não foi criada
  });

  it('conflito COM confirmConflict=true: CREATED com conflict=true', async () => {
    const s = await scenario();
    await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: s.position.id }],
    });
    const guitar = Position.create({ name: 'Violão', ministryId: s.ministry.id });
    await s.positionRepo.save(guitar);

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: s.member.id, positionId: guitar.id, confirmConflict: true }],
    });

    expect(result.needsConfirmation).toHaveLength(0);
    expect(result.created).toHaveLength(1);
    expect(result.created[0].conflict).toBe(true);
    expect(result.created[0].positionId).toBe(guitar.id);
  });

  it('item inválido (fora do ministério) vai para failed e NEM CHEGA a checar conflito', async () => {
    const s = await scenario();
    const outsider = Member.create({ institutionId: INST, name: 'Fora', email: 'fora2@example.com' });
    await s.memberRepo.save(outsider);
    const checkSpy = jest.spyOn(s.conflictDetection, 'check');

    const result = await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: outsider.id, positionId: s.position.id }],
    });

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toBe('Membro não pertence a este ministério');
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it('LOTE MISTO: uma limpa, uma inválida, uma conflituosa sem confirmação, uma conflituosa confirmada — cada uma no grupo certo', async () => {
    const s = await scenario();

    // Membro A: alocação limpa (sem conflito prévio).
    const memberA = Member.create({ institutionId: INST, name: 'A', email: 'a@example.com' });
    await s.memberRepo.save(memberA);
    await s.membershipRepo.save(MinistryMembership.create({ memberId: memberA.id, ministryId: s.ministry.id }));

    // Membro B: fora do ministério -> failed.
    const memberB = Member.create({ institutionId: INST, name: 'B', email: 'b@example.com' });
    await s.memberRepo.save(memberB);

    // Membro C: já tem 1 alocação nesta escala -> a nova função conflita, SEM confirmação.
    const memberC = Member.create({ institutionId: INST, name: 'C', email: 'c@example.com' });
    await s.memberRepo.save(memberC);
    await s.membershipRepo.save(MinistryMembership.create({ memberId: memberC.id, ministryId: s.ministry.id }));
    const positionC0 = Position.create({ name: 'Baixo', ministryId: s.ministry.id });
    await s.positionRepo.save(positionC0);
    const positionC1 = Position.create({ name: 'Bateria', ministryId: s.ministry.id });
    await s.positionRepo.save(positionC1);
    await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: memberC.id, positionId: positionC0.id }],
    });

    // Membro D: já tem 1 alocação nesta escala -> a nova função conflita, CONFIRMADA.
    const memberD = Member.create({ institutionId: INST, name: 'D', email: 'd@example.com' });
    await s.memberRepo.save(memberD);
    await s.membershipRepo.save(MinistryMembership.create({ memberId: memberD.id, ministryId: s.ministry.id }));
    const positionD0 = Position.create({ name: 'Teclado', ministryId: s.ministry.id });
    await s.positionRepo.save(positionD0);
    const positionD1 = Position.create({ name: 'Percussão', ministryId: s.ministry.id });
    await s.positionRepo.save(positionD1);
    await s.useCase.execute({
      institutionId: INST, actor: ADMIN_GERAL, scheduleId: s.schedule.id,
      items: [{ memberId: memberD.id, positionId: positionD0.id }],
    });

    const result = await s.useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      scheduleId: s.schedule.id,
      items: [
        { memberId: memberA.id, positionId: s.position.id },                       // limpa
        { memberId: memberB.id, positionId: s.position.id },                       // inválida
        { memberId: memberC.id, positionId: positionC1.id },                       // conflito, sem confirmação
        { memberId: memberD.id, positionId: positionD1.id, confirmConflict: true }, // conflito, confirmada
      ],
    });

    expect(result.created).toHaveLength(2); // A (limpa) + D (confirmada)
    const createdA = result.created.find((a) => a.memberId === memberA.id)!;
    expect(createdA.conflict).toBe(false);
    const createdD = result.created.find((a) => a.memberId === memberD.id)!;
    expect(createdD.conflict).toBe(true);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].item.memberId).toBe(memberB.id);

    expect(result.needsConfirmation).toHaveLength(1);
    expect(result.needsConfirmation[0].item.memberId).toBe(memberC.id);
    expect(result.needsConfirmation[0].conflicts).toHaveLength(1);

    // Parcial preservado: os criados (inclusive de chamadas anteriores) persistem
    // mesmo havendo falha e pendência no MESMO lote desta chamada.
    expect(s.assignmentRepo.assignments).toHaveLength(4); // C0, D0 (antes) + A, D1 (deste lote)
  });
});
