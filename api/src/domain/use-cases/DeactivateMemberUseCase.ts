import { Member } from '../entities/Member';
import { MemberRepository } from '../repositories/MemberRepository';
import { AppError } from '../../shared/errors/AppError';

/**
 * Desativa um membro (soft delete via campo ativo), garantindo que ele
 * pertence à instituição do usuário autenticado. Preferimos soft delete a
 * remoção física porque o Membro é referenciado por alocações, indisponibilidades,
 * trocas e notificações — apagá-lo quebraria o histórico de escalas. Desativar
 * preserva os dados e é reversível (basta reativar via PUT). Operação idempotente:
 * membro já inativo é retornado como está.
 */
export class DeactivateMemberUseCase {
  constructor(private readonly memberRepo: MemberRepository) {}

  async execute(dto: { id: string; institutionId: string }): Promise<Member> {
    const member = await this.memberRepo.findById(dto.id);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    if (!member.active) return member;
    return this.memberRepo.update(member.deactivate());
  }
}
