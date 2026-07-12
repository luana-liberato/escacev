import { Ministry } from '../../../entities/Ministry';
import { MinistryMembership } from '../../../entities/MinistryMembership';
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
import { CreateMinistryUseCase } from '../CreateMinistryUseCase';
import { GetMinistryUseCase } from '../GetMinistryUseCase';
import { ListMinistriesUseCase } from '../ListMinistriesUseCase';
import { UpdateMinistryUseCase } from '../UpdateMinistryUseCase';
import { DeleteMinistryUseCase } from '../DeleteMinistryUseCase';

/** Fake do MinistryRepository. findByName é case-insensitive (contrato do repo real). */
class FakeMinistryRepository implements MinistryRepository {
  ministries: Ministry[] = [];
  blocking: Record<string, MinistryBlockingDependencies> = {};
  deleted: string[] = [];

  async findById(id: string): Promise<Ministry | null> {
    return this.ministries.find((m) => m.id === id) ?? null;
  }
  async findByInstitution(institutionId: string): Promise<Ministry[]> {
    return this.ministries.filter((m) => m.institutionId === institutionId);
  }
  async findByName(name: string, institutionId: string): Promise<Ministry | null> {
    return (
      this.ministries.find(
        (m) => m.institutionId === institutionId && m.name.toLowerCase() === name.toLowerCase(),
      ) ?? null
    );
  }
  async save(ministry: Ministry): Promise<Ministry> {
    this.ministries.push(ministry);
    return ministry;
  }
  async update(ministry: Ministry): Promise<Ministry> {
    this.ministries = this.ministries.map((m) => (m.id === ministry.id ? ministry : m));
    return ministry;
  }
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
    this.ministries = this.ministries.filter((m) => m.id !== id);
  }
  async countBlockingDependencies(ministryId: string): Promise<MinistryBlockingDependencies> {
    return this.blocking[ministryId] ?? { schedules: 0, functionsInUse: 0 };
  }
}

/** Fake mínimo de membership só para alimentar a policy no teste de update. */
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

describe('CreateMinistryUseCase', () => {
  it('cria um ministério válido', async () => {
    const repo = new FakeMinistryRepository();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    expect(ministry.name).toBe('Louvor');
    expect(repo.ministries).toHaveLength(1);
  });

  it('rejeita nome duplicado na instituição, inclusive com caixa diferente (409)', async () => {
    const repo = new FakeMinistryRepository();
    const useCase = new CreateMinistryUseCase(repo);
    await useCase.execute({ institutionId: INST, name: 'Louvor' });

    await expect(useCase.execute({ institutionId: INST, name: 'LOUVOR' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.ministries).toHaveLength(1);
  });

  it('permite o mesmo nome em instituições diferentes', async () => {
    const repo = new FakeMinistryRepository();
    const useCase = new CreateMinistryUseCase(repo);
    await useCase.execute({ institutionId: INST, name: 'Louvor' });
    await useCase.execute({ institutionId: 'i2', name: 'Louvor' });

    expect(repo.ministries).toHaveLength(2);
  });
});

describe('GetMinistryUseCase', () => {
  it('404 quando o ministério é de outra instituição', async () => {
    const repo = new FakeMinistryRepository();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    await expect(
      new GetMinistryUseCase(repo).execute({ id: ministry.id, institutionId: 'i2' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ListMinistriesUseCase', () => {
  it('lista só os ministérios da instituição', async () => {
    const repo = new FakeMinistryRepository();
    const create = new CreateMinistryUseCase(repo);
    await create.execute({ institutionId: INST, name: 'Louvor' });
    await create.execute({ institutionId: INST, name: 'Recepção' });
    await create.execute({ institutionId: 'i2', name: 'Mídia' });

    const list = await new ListMinistriesUseCase(repo).execute({ institutionId: INST });
    expect(list.map((m) => m.name).sort()).toEqual(['Louvor', 'Recepção']);
  });
});

describe('UpdateMinistryUseCase', () => {
  function setup() {
    const repo = new FakeMinistryRepository();
    const membershipRepo = new FakeMembershipRepository();
    const policy = new MinistryAccessPolicy(membershipRepo);
    const useCase = new UpdateMinistryUseCase(repo, policy);
    return { repo, membershipRepo, useCase };
  }

  it('ADMIN_GERAL atualiza nome e descrição', async () => {
    const { repo, useCase } = setup();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    const updated = await useCase.execute({
      id: ministry.id,
      institutionId: INST,
      actor: ADMIN_GERAL,
      name: 'Louvor e Adoração',
      description: 'Música',
    });

    expect(updated.name).toBe('Louvor e Adoração');
    expect(updated.description).toBe('Música');
  });

  it('ADMIN_MINISTERIO com isAdmin naquele ministério pode atualizar', async () => {
    const { repo, membershipRepo, useCase } = setup();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });
    membershipRepo.memberships.push(
      MinistryMembership.create({ memberId: 'am', ministryId: ministry.id, isAdmin: true }),
    );

    const updated = await useCase.execute({
      id: ministry.id,
      institutionId: INST,
      actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
      name: 'Renomeado',
    });

    expect(updated.name).toBe('Renomeado');
  });

  it('ADMIN_MINISTERIO sem isAdmin naquele ministério recebe 403 (guarda escopada)', async () => {
    const { repo, useCase } = setup();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    await expect(
      useCase.execute({
        id: ministry.id,
        institutionId: INST,
        actor: { memberId: 'am', role: 'ADMIN_MINISTERIO' },
        name: 'Tentativa',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404 antes de checar permissão quando o ministério é de outra instituição', async () => {
    const { repo, useCase } = setup();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    await expect(
      useCase.execute({ id: ministry.id, institutionId: 'i2', actor: ADMIN_GERAL, name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('409 ao renomear para um nome já usado por outro ministério', async () => {
    const { repo, useCase } = setup();
    const create = new CreateMinistryUseCase(repo);
    await create.execute({ institutionId: INST, name: 'Recepção' });
    const louvor = await create.execute({ institutionId: INST, name: 'Louvor' });

    await expect(
      useCase.execute({
        id: louvor.id,
        institutionId: INST,
        actor: ADMIN_GERAL,
        name: 'Recepção',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('DeleteMinistryUseCase', () => {
  it('remove (cascata estrutural) quando não há dependência bloqueante', async () => {
    const repo = new FakeMinistryRepository();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    await new DeleteMinistryUseCase(repo).execute({ id: ministry.id, institutionId: INST });
    expect(repo.deleted).toContain(ministry.id);
    expect(repo.ministries).toHaveLength(0);
  });

  it('bloqueia com 409 quando há escalas do ministério (histórico)', async () => {
    const repo = new FakeMinistryRepository();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });
    repo.blocking[ministry.id] = { schedules: 2, functionsInUse: 0 };

    await expect(
      new DeleteMinistryUseCase(repo).execute({ id: ministry.id, institutionId: INST }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('escalas') });
    expect(repo.ministries).toHaveLength(1);
  });

  it('bloqueia com 409 quando há funções em uso em alocações', async () => {
    const repo = new FakeMinistryRepository();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });
    repo.blocking[ministry.id] = { schedules: 0, functionsInUse: 1 };

    await expect(
      new DeleteMinistryUseCase(repo).execute({ id: ministry.id, institutionId: INST }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('funções') });
  });

  it('404 ao remover ministério de outra instituição', async () => {
    const repo = new FakeMinistryRepository();
    const ministry = await new CreateMinistryUseCase(repo).execute({
      institutionId: INST,
      name: 'Louvor',
    });

    await expect(
      new DeleteMinistryUseCase(repo).execute({ id: ministry.id, institutionId: 'i2' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
