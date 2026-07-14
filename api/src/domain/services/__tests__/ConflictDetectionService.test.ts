import { Assignment } from '../../entities/Assignment';
import { PositionCompatibility } from '../../entities/PositionCompatibility';
import {
  AssignmentDetail,
  AssignmentRepository,
  MemberAssignmentContext,
} from '../../repositories/AssignmentRepository';
import { PositionCompatibilityRepository } from '../../repositories/PositionCompatibilityRepository';
import { CheckPositionCompatibilityUseCase } from '../../use-cases/position-compatibilities/CheckPositionCompatibilityUseCase';
import { ConflictDetectionService, ConflictCheckInput } from '../ConflictDetectionService';

/**
 * Fake do AssignmentRepository — só findByMemberWithContext é exercitado pelo
 * ConflictDetectionService; os demais métodos lançam se chamados por engano
 * (o serviço é uma consulta pura: não deve salvar/atualizar/remover nada).
 */
class FakeAssignmentRepository implements AssignmentRepository {
  contexts: MemberAssignmentContext[] = [];

  async findByMemberWithContext(): Promise<MemberAssignmentContext[]> {
    return this.contexts;
  }
  async findById(): Promise<Assignment | null> {
    throw new Error('não usado neste teste');
  }
  async findByScheduleWithDetails(): Promise<AssignmentDetail[]> {
    throw new Error('não usado neste teste');
  }
  async findByMemberPublishedInRange() {
    return [];
  }
  async save(): Promise<Assignment> {
    throw new Error('ConflictDetectionService não deveria gravar nada');
  }
  async update(): Promise<Assignment> {
    throw new Error('ConflictDetectionService não deveria gravar nada');
  }
  async delete(): Promise<void> {
    throw new Error('ConflictDetectionService não deveria gravar nada');
  }
  async existsByScheduleMemberPosition(): Promise<boolean> {
    throw new Error('não usado neste teste');
  }
}

/** Fake do repositório de compatibilidade — mesmo padrão de PositionCompatibilityUseCases.test.ts. */
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

const d = (s: string) => new Date(s);

/** Contexto de uma alocação existente, com defaults sobrescrevíveis por teste. */
function existingCtx(overrides: Partial<MemberAssignmentContext> = {}): MemberAssignmentContext {
  return {
    assignmentId: 'existing-1',
    memberName: 'Membro Existente',
    scheduleId: 'sch-1',
    ministryId: 'min-1',
    ministryName: 'Ministério Existente',
    eventId: 'ev-1',
    eventName: 'Culto Existente',
    positionId: 'psExisting',
    positionName: 'Função Existente',
    startsAt: d('2026-07-12T18:00:00Z'),
    endsAt: d('2026-07-12T20:00:00Z'),
    ...overrides,
  };
}

/** A nova alocação avaliada, com defaults sobrescrevíveis por teste. */
function newInput(overrides: Partial<ConflictCheckInput> = {}): ConflictCheckInput {
  return {
    memberId: 'mb1',
    positionId: 'psNew',
    startsAt: d('2026-07-12T18:00:00Z'),
    endsAt: d('2026-07-12T20:00:00Z'),
    ...overrides,
  };
}

function build() {
  const assignmentRepo = new FakeAssignmentRepository();
  const compatibilityRepo = new FakeCompatibilityRepository();
  const checkCompatibility = new CheckPositionCompatibilityUseCase(compatibilityRepo);
  const service = new ConflictDetectionService(assignmentRepo, checkCompatibility);
  return { assignmentRepo, compatibilityRepo, checkCompatibility, service };
}

describe('ConflictDetectionService — RN01 (sobreposição + incompatibilidade)', () => {
  it('1. sem nenhuma alocação existente do membro → sem conflito', async () => {
    const { service } = build();
    const result = await service.check(newInput());
    expect(result).toEqual({ hasConflict: false, conflicts: [] });
  });

  it('2. evento novo totalmente ANTES do existente → sem conflito (nem chama o Check)', async () => {
    const { assignmentRepo, checkCompatibility, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00
    const executeSpy = jest.spyOn(checkCompatibility, 'execute');

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T14:00:00Z'), endsAt: d('2026-07-12T16:00:00Z') }),
    );

    expect(result.hasConflict).toBe(false);
    expect(executeSpy).not.toHaveBeenCalled(); // sem sobreposição: nem checa compatibilidade
  });

  it('3. evento novo totalmente DEPOIS do existente → sem conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T22:00:00Z'), endsAt: d('2026-07-12T23:00:00Z') }),
    );

    expect(result.hasConflict).toBe(false);
  });

  it('4. sobreposição + funções COMPATÍVEIS (par na matriz) → sem conflito', async () => {
    const { assignmentRepo, compatibilityRepo, service } = build();
    assignmentRepo.contexts = [existingCtx({ positionId: 'psExisting' })];
    compatibilityRepo.rows.push(
      PositionCompatibility.create({ positionAId: 'psNew', positionBId: 'psExisting' }),
    );

    const result = await service.check(newInput()); // mesmo horário do existing → sobrepõe

    expect(result.hasConflict).toBe(false);
  });

  it('5. sobreposição + funções INCOMPATÍVEIS (par ausente, RN02 default) → conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx({ positionId: 'psExisting' })];
    // nenhuma compatibilidade registrada

    const result = await service.check(newInput());

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
  });

  it('6. sobreposição + MESMA função (mesmo positionId) → conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx({ positionId: 'psNew' })]; // mesma função do input

    const result = await service.check(newInput({ positionId: 'psNew' }));

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
  });
});

describe('ConflictDetectionService — fronteiras de sobreposição', () => {
  it('7. novo.inicio == existente.fim (toca no fim) → NÃO é sobreposição', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T20:00:00Z'), endsAt: d('2026-07-12T21:00:00Z') }),
    );

    expect(result.hasConflict).toBe(false);
  });

  it('8. novo.fim == existente.inicio (toca no início) → NÃO é sobreposição', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T16:00:00Z'), endsAt: d('2026-07-12T18:00:00Z') }),
    );

    expect(result.hasConflict).toBe(false);
  });

  it('9. sobreposição PARCIAL (começa antes do existente terminar, termina depois) → conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T19:00:00Z'), endsAt: d('2026-07-12T21:00:00Z') }),
    );

    expect(result.hasConflict).toBe(true);
  });

  it('10. novo evento CONTIDO dentro do existente → conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T18:30:00Z'), endsAt: d('2026-07-12T19:30:00Z') }),
    );

    expect(result.hasConflict).toBe(true);
  });

  it('11. existente CONTIDO dentro do novo (inverso do caso 10) → conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(
      newInput({ startsAt: d('2026-07-12T17:00:00Z'), endsAt: d('2026-07-12T21:00:00Z') }),
    );

    expect(result.hasConflict).toBe(true);
  });

  it('12. eventos com horário IDÊNTICO → sobreposição total → conflito', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx()]; // 18:00-20:00

    const result = await service.check(newInput()); // mesmo horário

    expect(result.hasConflict).toBe(true);
  });
});

describe('ConflictDetectionService — varredura institution-wide e cross-ministério (RN09)', () => {
  it('13. alocação existente em OUTRO ministério também é avaliada, com o nome desse ministério (transparência total)', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [
      existingCtx({ ministryId: 'ministerio-diferente', ministryName: 'Recepção' }),
    ];

    const result = await service.check(newInput()); // mesmo horário, funções incompatíveis

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts[0].ministryId).toBe('ministerio-diferente');
    expect(result.conflicts[0].ministryName).toBe('Recepção'); // sem filtragem por papel
  });

  it('14. múltiplas escalas do MESMO ministério e MESMO evento (ex.: "Berçário" e "Sala 1") não são isentas entre si', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [
      existingCtx({ assignmentId: 'a-bercario', scheduleId: 'sch-bercario', ministryId: 'min-infantil' }),
      existingCtx({ assignmentId: 'a-sala1', scheduleId: 'sch-sala1', ministryId: 'min-infantil' }),
    ];

    const result = await service.check(newInput());

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.map((c) => c.scheduleId).sort()).toEqual(['sch-bercario', 'sch-sala1']);
  });

  it('17. mesma escala, mesmo evento, função diferente já alocada nessa escala → segue a regra normal', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx({ scheduleId: 'sch-atual', positionId: 'psOutraFuncao' })];

    const result = await service.check(newInput());

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts[0].scheduleId).toBe('sch-atual');
  });
});

describe('ConflictDetectionService — múltiplos conflitos e detalhes', () => {
  it('15. múltiplos conflitos simultâneos → retorna TODOS', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [
      existingCtx({ assignmentId: 'a1', positionId: 'ps1' }),
      existingCtx({ assignmentId: 'a2', positionId: 'ps2' }),
    ];

    const result = await service.check(newInput());

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts.map((c) => c.assignmentId).sort()).toEqual(['a1', 'a2']);
  });

  it('16. mistura: 1 conflita, 1 compatível (sobrepõe mas não conflita), 1 sem sobreposição → só a que conflita é retornada', async () => {
    const { assignmentRepo, compatibilityRepo, service } = build();
    assignmentRepo.contexts = [
      existingCtx({ assignmentId: 'conflita', positionId: 'psIncompativel' }), // sobrepõe, incompatível
      existingCtx({ assignmentId: 'compativel', positionId: 'psCompativel' }), // sobrepõe, compatível
      existingCtx({
        assignmentId: 'sem-sobreposicao',
        positionId: 'psIncompativel',
        startsAt: d('2026-07-12T22:00:00Z'),
        endsAt: d('2026-07-12T23:00:00Z'),
      }), // não sobrepõe
    ];
    compatibilityRepo.rows.push(
      PositionCompatibility.create({ positionAId: 'psNew', positionBId: 'psCompativel' }),
    );

    const result = await service.check(newInput());

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].assignmentId).toBe('conflita');
  });

  it('detalhe do conflito expõe evento, escala, ministério e função (ids E nomes legíveis) para o admin decidir', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [
      existingCtx({
        assignmentId: 'a1',
        memberName: 'Maria',
        scheduleId: 'sch-x',
        ministryId: 'min-x',
        ministryName: 'Recepção',
        eventId: 'ev-x',
        eventName: 'Culto da Manhã',
        positionId: 'psExisting',
        positionName: 'Recepcionista',
      }),
    ];

    const result = await service.check(newInput());

    // "Maria já está como Recepcionista no Culto da Manhã (Recepção), 18h-20h"
    // — o front monta essa frase direto da resposta, sem consultas extras.
    expect(result.conflicts[0]).toEqual({
      assignmentId: 'a1',
      memberName: 'Maria',
      scheduleId: 'sch-x',
      ministryId: 'min-x',
      ministryName: 'Recepção',
      eventId: 'ev-x',
      eventName: 'Culto da Manhã',
      positionId: 'psExisting',
      positionName: 'Recepcionista',
      startsAt: d('2026-07-12T18:00:00Z'),
      endsAt: d('2026-07-12T20:00:00Z'),
    });
  });
});

describe('ConflictDetectionService — excludeAssignmentId (suporte à edição futura)', () => {
  it('18. ignora a alocação indicada em excludeAssignmentId, mesmo que conflitaria', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [existingCtx({ assignmentId: 'a-sendo-editada' })];

    const result = await service.check(newInput({ excludeAssignmentId: 'a-sendo-editada' }));

    expect(result.hasConflict).toBe(false);
  });

  it('exclui só a indicada; as demais continuam sendo avaliadas', async () => {
    const { assignmentRepo, service } = build();
    assignmentRepo.contexts = [
      existingCtx({ assignmentId: 'a-sendo-editada' }),
      existingCtx({ assignmentId: 'a-outra' }),
    ];

    const result = await service.check(newInput({ excludeAssignmentId: 'a-sendo-editada' }));

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].assignmentId).toBe('a-outra');
  });
});
