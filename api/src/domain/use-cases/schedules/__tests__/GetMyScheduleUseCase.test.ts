import { Assignment } from '../../../entities/Assignment';
import {
  AssignmentDetail,
  AssignmentRepository,
  DateRange,
  MemberAssignmentContext,
  MemberScheduleEntry,
} from '../../../repositories/AssignmentRepository';
import { GetMyScheduleUseCase } from '../GetMyScheduleUseCase';

const d = (s: string) => new Date(s);

/**
 * Fake do AssignmentRepository focado no member view: `findByMemberPublishedInRange`
 * devolve uma lista pré-carregada (a filtragem real por status/período é do
 * repositório Prisma, coberta no E2E). Os demais métodos não são exercitados aqui.
 */
class FakeAssignmentRepository implements AssignmentRepository {
  entries: MemberScheduleEntry[] = [];
  lastRange: DateRange | null = null;

  async findByMemberPublishedInRange(_memberId: string, range: DateRange): Promise<MemberScheduleEntry[]> {
    this.lastRange = range;
    return this.entries;
  }
  async findById(): Promise<Assignment | null> {
    return null;
  }
  async findByScheduleWithDetails(): Promise<AssignmentDetail[]> {
    return [];
  }
  async findByMemberWithContext(): Promise<MemberAssignmentContext[]> {
    return [];
  }
  async save(a: Assignment): Promise<Assignment> {
    return a;
  }
  async update(a: Assignment): Promise<Assignment> {
    return a;
  }
  async delete(): Promise<void> {}
  async existsByScheduleMemberPosition(): Promise<boolean> {
    return false;
  }
}

function entry(overrides: Partial<MemberScheduleEntry> = {}): MemberScheduleEntry {
  return {
    assignmentId: 'a1',
    scheduleId: 's1',
    scheduleName: '',
    ministryId: 'min1',
    ministryName: 'Louvor',
    eventId: 'ev1',
    eventName: 'Culto',
    eventType: 'culto',
    startsAt: d('2026-07-12T18:00:00Z'),
    endsAt: d('2026-07-12T20:00:00Z'),
    positionId: 'p1',
    positionName: 'Vocal',
    ...overrides,
  };
}

const RANGE: DateRange = { from: d('2026-07-01T00:00:00Z'), to: d('2026-07-31T23:59:59Z') };

describe('GetMyScheduleUseCase', () => {
  it('devolve as entries do repositório e ecoa o período consultado', async () => {
    const repo = new FakeAssignmentRepository();
    repo.entries = [entry({ ministryName: 'Louvor' }), entry({ assignmentId: 'a2', ministryName: 'Mídia' })];

    const result = await new GetMyScheduleUseCase(repo).execute({ memberId: 'm1', range: RANGE });

    expect(result.entries).toHaveLength(2);
    expect(result.from).toEqual(RANGE.from);
    expect(result.to).toEqual(RANGE.to);
    // O período é repassado ao repositório sem alteração.
    expect(repo.lastRange).toEqual(RANGE);
  });

  it('período vazio: entries []', async () => {
    const repo = new FakeAssignmentRepository();

    const result = await new GetMyScheduleUseCase(repo).execute({ memberId: 'm1', range: RANGE });

    expect(result.entries).toEqual([]);
  });

  it('400 quando from é depois de to', async () => {
    const repo = new FakeAssignmentRepository();

    await expect(
      new GetMyScheduleUseCase(repo).execute({
        memberId: 'm1',
        range: { from: d('2026-07-31T00:00:00Z'), to: d('2026-07-01T00:00:00Z') },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
