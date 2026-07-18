import { Ministry } from '../../../entities/Ministry';
import { Position } from '../../../entities/Position';
import { PositionCompatibility } from '../../../entities/PositionCompatibility';
import { PositionCompatibilityRepository } from '../../../repositories/PositionCompatibilityRepository';
import { PositionRepository } from '../../../repositories/PositionRepository';
import {
  MinistryRepository,
  MinistryBlockingDependencies,
} from '../../../repositories/MinistryRepository';
import { Actor } from '../../../services/MinistryAccessPolicy';
import { SetPositionCompatibilityUseCase } from '../SetPositionCompatibilityUseCase';
import { RemovePositionCompatibilityUseCase } from '../RemovePositionCompatibilityUseCase';
import { CheckPositionCompatibilityUseCase } from '../CheckPositionCompatibilityUseCase';
import { ListPositionCompatibilitiesUseCase } from '../ListPositionCompatibilitiesUseCase';

/** Fake do repo de compatibilidade — ordena o par na fronteira, como o real. */
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

class FakePositionRepository implements PositionRepository {
  positions: Position[] = [];
  async findById(id: string): Promise<Position | null> {
    return this.positions.find((p) => p.id === id) ?? null;
  }
  async findByMinistry(): Promise<Position[]> {
    return [];
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

class FakeMinistryRepository implements MinistryRepository {
  ministries: Ministry[] = [];
  async findById(id: string): Promise<Ministry | null> {
    return this.ministries.find((m) => m.id === id) ?? null;
  }
  async findByInstitution(): Promise<Ministry[]> {
    return [];
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

const INST = 'i1';
const ADMIN_GERAL: Actor = { memberId: 'ag', role: 'ADMIN_GERAL' };
const ADMIN_MIN: Actor = { memberId: 'am', role: 'ADMIN_MINISTERIO' };

/**
 * Duas funções em ministérios diferentes, ambas da instituição INST — reflete o
 * caso real de que a matriz pode ligar funções de ministérios distintos (por isso
 * é escopo de instituição, só ADMIN_GERAL).
 */
async function scenario() {
  const compatibilityRepo = new FakeCompatibilityRepository();
  const positionRepo = new FakePositionRepository();
  const ministryRepo = new FakeMinistryRepository();

  const minA = Ministry.create({ institutionId: INST, name: 'Louvor' });
  const minB = Ministry.create({ institutionId: INST, name: 'Mídia' });
  await ministryRepo.save(minA);
  await ministryRepo.save(minB);
  const fa = Position.create({ name: 'Vocal', ministryId: minA.id });
  const fb = Position.create({ name: 'Câmera', ministryId: minB.id });
  await positionRepo.save(fa);
  await positionRepo.save(fb);

  return { compatibilityRepo, positionRepo, ministryRepo, fa, fb };
}

describe('SetPositionCompatibilityUseCase', () => {
  it('marca o par como compatível na forma canônica', async () => {
    const s = await scenario();
    const useCase = new SetPositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    const row = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      positionAId: s.fa.id,
      positionBId: s.fb.id,
    });

    const [a, b] = PositionCompatibility.orderPair(s.fa.id, s.fb.id);
    expect(row.positionAId).toBe(a);
    expect(row.positionBId).toBe(b);
    expect(s.compatibilityRepo.rows).toHaveLength(1);
  });

  it('é idempotente: remarcar o par (mesmo invertendo a ordem) não cria linha nova', async () => {
    const s = await scenario();
    const useCase = new SetPositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    const first = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      positionAId: s.fa.id,
      positionBId: s.fb.id,
    });
    const again = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      positionAId: s.fb.id, // ordem invertida
      positionBId: s.fa.id,
    });

    expect(again.id).toBe(first.id);
    expect(s.compatibilityRepo.rows).toHaveLength(1);
  });

  it('ADMIN_MINISTERIO também define a matriz (decisão jul/2026 — escopo de instituição, sem checagem de papel no use case)', async () => {
    const s = await scenario();
    const useCase = new SetPositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    const compatibility = await useCase.execute({
      institutionId: INST,
      actor: ADMIN_MIN,
      positionAId: s.fa.id,
      positionBId: s.fb.id,
    });

    expect(compatibility).toBeDefined();
    expect(s.compatibilityRepo.rows).toHaveLength(1);
  });

  it('404 quando uma das funções é de outra instituição', async () => {
    const s = await scenario();
    const foreignMin = Ministry.create({ institutionId: 'i2', name: 'Alheio' });
    await s.ministryRepo.save(foreignMin);
    const foreign = Position.create({ name: 'X', ministryId: foreignMin.id });
    await s.positionRepo.save(foreign);
    const useCase = new SetPositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        positionAId: s.fa.id,
        positionBId: foreign.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('400 ao tentar marcar uma função compatível consigo mesma', async () => {
    const s = await scenario();
    const useCase = new SetPositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        positionAId: s.fa.id,
        positionBId: s.fa.id,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('RemovePositionCompatibilityUseCase', () => {
  it('remove um par existente (volta a incompatível)', async () => {
    const s = await scenario();
    await s.compatibilityRepo.save(
      PositionCompatibility.create({ positionAId: s.fa.id, positionBId: s.fb.id }),
    );
    const useCase = new RemovePositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    await useCase.execute({
      institutionId: INST,
      actor: ADMIN_GERAL,
      positionAId: s.fa.id,
      positionBId: s.fb.id,
    });
    expect(s.compatibilityRepo.rows).toHaveLength(0);
  });

  it('é idempotente: remover par ausente (entre funções válidas) não lança', async () => {
    const s = await scenario();
    const useCase = new RemovePositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        positionAId: s.fa.id,
        positionBId: s.fb.id,
      }),
    ).resolves.toBeUndefined();
  });

  it('404 quando uma função é inválida/de outro tenant (entrada inválida, não par ausente)', async () => {
    const s = await scenario();
    const useCase = new RemovePositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_GERAL,
        positionAId: s.fa.id,
        positionBId: 'nao-existe',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('ADMIN_MINISTERIO também remove da matriz (sem checagem de papel no use case)', async () => {
    const s = await scenario();
    await s.compatibilityRepo.save(
      PositionCompatibility.create({ positionAId: s.fa.id, positionBId: s.fb.id }),
    );
    const useCase = new RemovePositionCompatibilityUseCase(
      s.compatibilityRepo,
      s.positionRepo,
      s.ministryRepo,
    );

    await expect(
      useCase.execute({
        institutionId: INST,
        actor: ADMIN_MIN,
        positionAId: s.fa.id,
        positionBId: s.fb.id,
      }),
    ).resolves.toBeUndefined();
    expect(s.compatibilityRepo.rows).toHaveLength(0);
  });
});

describe('CheckPositionCompatibilityUseCase (será injetado no motor de conflito, Fase 5)', () => {
  it('true quando existe o par, independentemente da ordem dos ids', async () => {
    const s = await scenario();
    await s.compatibilityRepo.save(
      PositionCompatibility.create({ positionAId: s.fa.id, positionBId: s.fb.id }),
    );
    const check = new CheckPositionCompatibilityUseCase(s.compatibilityRepo);

    expect(await check.execute(s.fa.id, s.fb.id)).toBe(true);
    expect(await check.execute(s.fb.id, s.fa.id)).toBe(true);
  });

  it('false quando o par não existe (default incompatível — RN02)', async () => {
    const s = await scenario();
    const check = new CheckPositionCompatibilityUseCase(s.compatibilityRepo);

    expect(await check.execute(s.fa.id, s.fb.id)).toBe(false);
  });

  it('false para ids iguais (mesma função sobreposta — não há linha canônica)', async () => {
    const s = await scenario();
    const check = new CheckPositionCompatibilityUseCase(s.compatibilityRepo);

    expect(await check.execute(s.fa.id, s.fa.id)).toBe(false);
  });
});

describe('ListPositionCompatibilitiesUseCase', () => {
  it('lista os pares da instituição para o ADMIN_GERAL', async () => {
    const s = await scenario();
    await s.compatibilityRepo.save(
      PositionCompatibility.create({ positionAId: s.fa.id, positionBId: s.fb.id }),
    );
    const useCase = new ListPositionCompatibilitiesUseCase(s.compatibilityRepo);

    const rows = await useCase.execute({ institutionId: INST, actor: ADMIN_GERAL });
    expect(rows).toHaveLength(1);
  });

  it('ADMIN_MINISTERIO também lista (sem checagem de papel no use case)', async () => {
    const s = await scenario();
    const useCase = new ListPositionCompatibilitiesUseCase(s.compatibilityRepo);

    await expect(
      useCase.execute({ institutionId: INST, actor: ADMIN_MIN }),
    ).resolves.toBeInstanceOf(Array);
  });
});
