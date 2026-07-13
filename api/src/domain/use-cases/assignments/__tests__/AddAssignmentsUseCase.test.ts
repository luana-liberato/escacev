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
import { AddAssignmentsUseCase } from '../AddAssignmentsUseCase';

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

  async save(assignment: Assignment): Promise<Assignment> {
    if (this.throwOnNextSave) {
      this.throwOnNextSave = false;
      throw new Error('Unique constraint failed (simulado)');
    }
    this.assignments.push(assignment);
    return assignment;
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

/** Instituição padrão: 1 ministério, 1 escala, 1 membro e 1 função pertencentes a ele. */
async function scenario() {
  const ministryRepo = new FakeMinistryRepository();
  const scheduleRepo = new FakeScheduleRepository();
  const memberRepo = new FakeMemberRepository();
  const positionRepo = new FakePositionRepository();
  const membershipRepo = new FakeMembershipRepository();
  const assignmentRepo = new FakeAssignmentRepository();
  const policy = new MinistryAccessPolicy(membershipRepo);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);
  const schedule = Schedule.create({ ministryId: ministry.id, eventId: 'ev1' });
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
    memberRepo,
    positionRepo,
    membershipRepo,
    policy,
  );

  return {
    ministryRepo, scheduleRepo, memberRepo, positionRepo, membershipRepo, assignmentRepo, policy,
    ministry, schedule, member, position, useCase,
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
