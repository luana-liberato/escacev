import { MinistryRepository } from '../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';
import { Actor, MinistryAccessPolicy } from '../services/MinistryAccessPolicy';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface RemoveMemberFromMinistryDTO {
  institutionId: string;
  actor: Actor;
  ministryId: string;
  memberId: string;
}

/**
 * Remove o vínculo de um membro com um ministério (deixa de participar). Valida
 * que o ministério pertence à instituição do usuário, que o ator administra o
 * ministério (Permissão Escopada) e que o vínculo existe (404).
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class RemoveMemberFromMinistryUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: RemoveMemberFromMinistryDTO): Promise<void> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

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
