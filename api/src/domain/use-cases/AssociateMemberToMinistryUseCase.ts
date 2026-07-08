import { MinistryMembership } from '../entities/MinistryMembership';
import { MemberRepository } from '../repositories/MemberRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';
import { Actor, MinistryAccessPolicy } from '../services/MinistryAccessPolicy';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface AssociateMemberToMinistryDTO {
  institutionId: string;
  actor: Actor;
  ministryId: string;
  memberId: string;
  isAdmin?: boolean;
}

/**
 * Associa um membro JÁ EXISTENTE a um ministério (o membro passa a participar;
 * isAdmin = true = também administra). Valida que ministério e membro pertencem
 * à instituição do usuário, que o ator administra o ministério (Permissão
 * Escopada) e impede associação duplicada (409).
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class AssociateMemberToMinistryUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly memberRepo: MemberRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: AssociateMemberToMinistryDTO): Promise<MinistryMembership> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    const member = await this.memberRepo.findById(dto.memberId);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    const existing = await this.membershipRepo.findByMemberAndMinistry(
      member.id,
      ministry.id,
    );
    if (existing) {
      throw new AppError('Este membro já está neste ministério', 409);
    }

    const membership = MinistryMembership.create({
      memberId: member.id,
      ministryId: ministry.id,
      isAdmin: dto.isAdmin,
    });
    return this.membershipRepo.save(membership);
  }
}
