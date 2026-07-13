import { Member } from '../../entities/Member';
import { MinistryMembership } from '../../entities/MinistryMembership';
import { Position } from '../../entities/Position';
import { MemberRepository } from '../../repositories/MemberRepository';
import { PositionRepository } from '../../repositories/PositionRepository';
import {
  MinistryMembershipRepository,
  MinistryMemberView,
  MemberMinistryView,
} from '../../repositories/MinistryMembershipRepository';
import { AssignmentEligibility } from '../AssignmentEligibility';

/**
 * Fakes em memória — cobre AssignmentEligibility isoladamente (nível unitário,
 * sem banco). É a lógica extraída do AddAssignmentsUseCase e compartilhada com
 * o UpdateAssignmentUseCase; testada aqui uma única vez.
 */
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

const MINISTRY_ID = 'min1';

function build() {
  const memberRepo = new FakeMemberRepository();
  const positionRepo = new FakePositionRepository();
  const membershipRepo = new FakeMembershipRepository();
  const eligibility = new AssignmentEligibility(memberRepo, positionRepo, membershipRepo);
  return { memberRepo, positionRepo, membershipRepo, eligibility };
}

describe('AssignmentEligibility.checkMember', () => {
  it('null quando o membro pertence ao ministério', async () => {
    const { memberRepo, membershipRepo, eligibility } = build();
    const member = Member.create({ institutionId: 'i1', name: 'João', email: 'joao@example.com' });
    await memberRepo.save(member);
    await membershipRepo.save(MinistryMembership.create({ memberId: member.id, ministryId: MINISTRY_ID }));

    expect(await eligibility.checkMember(member.id, MINISTRY_ID)).toBeNull();
  });

  it('404 (não encontrado) quando o membro não existe', async () => {
    const { eligibility } = build();

    expect(await eligibility.checkMember('nao-existe', MINISTRY_ID)).toEqual({
      reason: 'Membro não encontrado',
      statusCode: 404,
    });
  });

  it('400 (não pertence) quando o membro existe mas não está no ministério', async () => {
    const { memberRepo, eligibility } = build();
    const member = Member.create({ institutionId: 'i1', name: 'Fora', email: 'fora@example.com' });
    await memberRepo.save(member);

    expect(await eligibility.checkMember(member.id, MINISTRY_ID)).toEqual({
      reason: 'Membro não pertence a este ministério',
      statusCode: 400,
    });
  });
});

describe('AssignmentEligibility.checkPosition', () => {
  it('null quando a função pertence ao ministério', async () => {
    const { positionRepo, eligibility } = build();
    const position = Position.create({ name: 'Vocal', ministryId: MINISTRY_ID });
    await positionRepo.save(position);

    expect(await eligibility.checkPosition(position.id, MINISTRY_ID)).toBeNull();
  });

  it('404 (não encontrada) quando a função não existe', async () => {
    const { eligibility } = build();

    expect(await eligibility.checkPosition('nao-existe', MINISTRY_ID)).toEqual({
      reason: 'Função não encontrada',
      statusCode: 404,
    });
  });

  it('400 (não pertence) quando a função é de outro ministério', async () => {
    const { positionRepo, eligibility } = build();
    const position = Position.create({ name: 'Câmera', ministryId: 'outro-ministerio' });
    await positionRepo.save(position);

    expect(await eligibility.checkPosition(position.id, MINISTRY_ID)).toEqual({
      reason: 'Função não pertence a este ministério',
      statusCode: 400,
    });
  });
});
