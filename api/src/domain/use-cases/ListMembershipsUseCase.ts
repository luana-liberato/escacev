import { MemberRepository } from '../repositories/MemberRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import {
  MemberMinistryView,
  MinistryMemberView,
  MinistryMembershipRepository,
} from '../repositories/MinistryMembershipRepository';
import { AppError } from '../../shared/errors/AppError';

/**
 * Listagens do vínculo Membro↔Ministério, sempre indicando o isAdmin de cada
 * associação. Valida o escopo pela instituição do usuário antes de listar.
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class ListMembershipsUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly memberRepo: MemberRepository,
  ) {}

  /** Membros de um ministério da própria instituição (com isAdmin). */
  async membersOfMinistry(dto: {
    institutionId: string;
    ministryId: string;
  }): Promise<MinistryMemberView[]> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }
    return this.membershipRepo.findMembersByMinistry(ministry.id);
  }

  /** Ministérios de um membro da própria instituição (com isAdmin). */
  async ministriesOfMember(dto: {
    institutionId: string;
    memberId: string;
  }): Promise<MemberMinistryView[]> {
    const member = await this.memberRepo.findById(dto.memberId);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }
    return this.membershipRepo.findMinistriesByMember(member.id);
  }
}
