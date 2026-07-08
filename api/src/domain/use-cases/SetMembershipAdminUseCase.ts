import { MinistryMembership } from '../entities/MinistryMembership';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface SetMembershipAdminDTO {
  institutionId: string;
  ministryId: string;
  memberId: string;
  isAdmin: boolean;
}

/**
 * Promove (isAdmin = true) ou rebaixa (isAdmin = false) o papel de admin de um
 * vínculo existente. Valida que o ministério pertence à instituição do usuário
 * e que o vínculo existe (404). Dependências injetadas via construtor (Seção 4.2).
 */
export class SetMembershipAdminUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: SetMembershipAdminDTO): Promise<MinistryMembership> {
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

    return this.membershipRepo.update(membership.setAdmin(dto.isAdmin));
  }
}
