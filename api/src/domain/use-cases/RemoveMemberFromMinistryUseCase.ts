import { MinistryRepository } from '../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface RemoveMemberFromMinistryDTO {
  institutionId: string;
  ministryId: string;
  memberId: string;
}

/**
 * Remove o vínculo de um membro com um ministério (deixa de participar). Valida
 * que o ministério pertence à instituição do usuário e que o vínculo existe (404).
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class RemoveMemberFromMinistryUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: RemoveMemberFromMinistryDTO): Promise<void> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    const membership = await this.membershipRepo.findByMemberAndMinistry(
      dto.memberId,
      ministry.id,
    );
    if (!membership) {
      throw new AppError('Este membro não está neste ministério', 404);
    }

    await this.membershipRepo.delete(membership.id);
  }
}
