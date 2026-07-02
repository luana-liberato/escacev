import { Member } from '../entities/Member';
import { MemberRepository } from '../repositories/MemberRepository';

/**
 * Lista todos os membros da instituição do usuário autenticado.
 * O institutionId vem do JWT (req.user) — garante o isolamento por tenant.
 */
export class ListMembersUseCase {
  constructor(private readonly memberRepo: MemberRepository) {}

  execute(dto: { institutionId: string }): Promise<Member[]> {
    return this.memberRepo.findByInstitution(dto.institutionId);
  }
}
