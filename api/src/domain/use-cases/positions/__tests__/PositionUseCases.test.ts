import { Ministry } from '../../../entities/Ministry';
import { Position } from '../../../entities/Position';
import { MinistryMembership } from '../../../entities/MinistryMembership';
import { PositionRepository } from '../../../repositories/PositionRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../../repositories/MinistryMembershipRepository';
import { MinistryAccessPolicy, Actor } from '../../../services/MinistryAccessPolicy';
import { CreatePositionUseCase } from '../CreatePositionUseCase';
import { ListPositionsUseCase } from '../ListPositionsUseCase';
import { GetPositionUseCase } from '../GetPositionUseCase';
import { UpdatePositionUseCase } from '../UpdatePositionUseCase';
import { DeletePositionUseCase } from '../DeletePositionUseCase';

class FakePositionRepository implements PositionRepository {
  positions: Position[] = [];
  usage: Record<string, number> = {};
  deleted: string[] = [];
  async findById(id: string): Promise<Position | null> {
    return this.positions.find((p) => p.id === id) ?? null;
  }
  async findByMinistry(ministryId: string): Promise<Position[]> {
    return this.positions.filter((p) => p.ministryId === ministryId);
  }
  async findByNameInMinistry(ministryId: string, name: string): Promise<Position | null> {
    return (
      this.positions.find(
        (p) => p.ministryId === ministryId && p.name.toLowerCase() === name.toLowerCase(),
      ) ?? null
    );
  }
  async save(position: Position): Promise<Position> {
    this.positions.push(position);
    return position;
  }
  async update(position: Position): Promise<Position> {
    this.positions = this.positions.map((p) => (p.id === position.id ? position : p));
    return position;
  }
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.positions = this.positions.filter((p) => p.id !== id);
  }
  async countEventSlotUsage(id: string): Promise<number> {
    return this.usage[id] ?? 0;
  }
}

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

async function scenario() {
  const positionRepo = new FakePositionRepository();
  const ministryRepo = new FakeMinistryRepository();
  const membershipRepo = new FakeMembershipRepository();
  const policy = new MinistryAccessPolicy(membershipRepo);

  const ministry = Ministry.create({ institutionId: INST, name: 'Louvor' });
  await ministryRepo.save(ministry);

  return { positionRepo, ministryRepo, membershipRepo, policy, ministry };
}

describe('CreatePositionUseCase', () => {
  it('ADMIN_GERAL cria função no ministério', async () => {
    const s = await scenario();
    const useCase = new CreatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    const position = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'Baterista',
    });

    expect(position.name).toBe('Baterista');
    expect(position.ministryId).toBe(s.ministry.id);
  });

  it('409 para nome de função duplicado no mesmo ministério', async () => {
    const s = await scenario();
    const useCase = new CreatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);
    await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      ministryId: s.ministry.id,
      name: 'Vocal',
    });

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        ministryId: s.ministry.id,
        name: 'VOCAL',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('403 quando ADMIN_MINISTERIO não é admin daquele ministério (guarda escopada)', async () => {
    const s = await scenario();
    const useCase = new CreatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        ministryId: s.ministry.id,
        name: 'Baterista',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('ADMIN_MINISTERIO com isAdmin naquele ministério cria função', async () => {
    const s = await scenario();
    s.membershipRepo.memberships.push(
      MinistryMembership.create({ memberId: 'am', ministryId: s.ministry.id, isAdmin: true }),
    );
    const useCase = new CreatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    const position = await useCase.execute({
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      ministryId: s.ministry.id,
      name: 'Guitarrista',
    });
    expect(position.name).toBe('Guitarrista');
  });

  it('404 quando o ministério é de outra instituição', async () => {
    const s = await scenario();
    const useCase = new CreatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({
        institutionId: 'i2',
        actor: ADMIN_GERAL,
        ministryId: s.ministry.id,
        name: 'Baterista',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ListPositionsUseCase', () => {
  it('lista funções do ministério da própria instituição', async () => {
    const s = await scenario();
    await s.positionRepo.save(Position.create({ name: 'Vocal', ministryId: s.ministry.id }));
    await s.positionRepo.save(Position.create({ name: 'Baixo', ministryId: s.ministry.id }));
    const useCase = new ListPositionsUseCase(s.positionRepo, s.ministryRepo);

    const list = await useCase.execute({ institutionId: INST, ministryId: s.ministry.id });
    expect(list).toHaveLength(2);
  });

  it('404 ao listar funções de ministério de outra instituição', async () => {
    const s = await scenario();
    const useCase = new ListPositionsUseCase(s.positionRepo, s.ministryRepo);

    await expect(
      useCase.execute({ institutionId: 'i2', ministryId: s.ministry.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('GetPositionUseCase (achado O1 — use case sem rota, coberto no unitário)', () => {
  it('retorna a função quando pertence ao tenant', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new GetPositionUseCase(s.positionRepo, s.ministryRepo);

    const found = await useCase.execute({ institutionId: INST, id: position.id });
    expect(found.id).toBe(position.id);
  });

  it('404 quando a função é de outra instituição', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new GetPositionUseCase(s.positionRepo, s.ministryRepo);

    await expect(
      useCase.execute({ institutionId: 'i2', id: position.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 quando a função não existe', async () => {
    const s = await scenario();
    const useCase = new GetPositionUseCase(s.positionRepo, s.ministryRepo);

    await expect(
      useCase.execute({ institutionId: INST, id: 'nao-existe' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UpdatePositionUseCase', () => {
  it('ADMIN_GERAL renomeia a função', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new UpdatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    const updated = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      id: position.id,
      name: 'Backing Vocal',
    });
    expect(updated.name).toBe('Backing Vocal');
  });

  it('409 ao renomear para nome já usado por outra função do mesmo ministério', async () => {
    const s = await scenario();
    await s.positionRepo.save(Position.create({ name: 'Baixo', ministryId: s.ministry.id }));
    const vocal = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new UpdatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: vocal.id, name: 'Baixo' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('403 quando o ator não administra o ministério', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new UpdatePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        id: position.id,
        name: 'X',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('DeletePositionUseCase', () => {
  it('remove função sem uso em alocações', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new DeletePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: position.id });
    expect(s.positionRepo.deleted).toContain(position.id);
  });

  it('409 quando a função está em uso em alocações', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    s.positionRepo.usage[position.id] = 3;
    const useCase = new DeletePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({ institutionId: INST, actor: ADMIN_GERAL, id: position.id }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(s.positionRepo.positions).toHaveLength(1);
  });

  it('403 quando o ator não administra o ministério', async () => {
    const s = await scenario();
    const position = await s.positionRepo.save(
      Position.create({ name: 'Vocal', ministryId: s.ministry.id }),
    );
    const useCase = new DeletePositionUseCase(s.positionRepo, s.ministryRepo, s.policy);

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        id: position.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
