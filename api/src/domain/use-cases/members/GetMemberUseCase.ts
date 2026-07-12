import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Busca um membro por id, garantindo que ele pertence à instituição do
 * usuário autenticado. Se não existir ou for de outra instituição, responde
 * 404 (não vaza a existência de membros de outros tenants — relevante para v2).
 */
export class GetMemberUseCase {
  constructor(private readonly memberRepo: MemberRepository) {}

  async execute(dto: { id: string; institutionId: string }): Promise<Member> {
    const member = await this.memberRepo.findById(dto.id);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }
    return member;
  }
}
