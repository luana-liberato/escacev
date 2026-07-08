import { Member } from '../entities/Member';
import { Ministry } from '../entities/Ministry';
import { MinistryMembership } from '../entities/MinistryMembership';

/**
 * Membro de um ministério com o vínculo correspondente — alimenta a listagem
 * "membros deste ministério (com isAdmin)".
 */
export interface MinistryMemberView {
  membership: MinistryMembership;
  member: Member;
}

/**
 * Ministério de um membro com o vínculo correspondente — alimenta a listagem
 * "ministérios deste membro (com isAdmin)".
 */
export interface MemberMinistryView {
  membership: MinistryMembership;
  ministry: Ministry;
}

/**
 * Abstração de persistência do vínculo Membro↔Ministério. Use cases dependem
 * desta interface, nunca do PrismaClient diretamente (Seção 4.2 do CLAUDE.md).
 * O escopo por instituição é validado nos use cases (via Ministry/Member).
 */
export interface MinistryMembershipRepository {
  /** Vínculo de um membro num ministério específico (checa duplicidade / existência). */
  findByMemberAndMinistry(
    memberId: string,
    ministryId: string,
  ): Promise<MinistryMembership | null>;
  /** Membros de um ministério, cada um com seu vínculo (isAdmin). */
  findMembersByMinistry(ministryId: string): Promise<MinistryMemberView[]>;
  /** Ministérios de um membro, cada um com seu vínculo (isAdmin). */
  findMinistriesByMember(memberId: string): Promise<MemberMinistryView[]>;
  /** Persiste um novo vínculo. */
  save(membership: MinistryMembership): Promise<MinistryMembership>;
  /** Atualiza o papel de admin (isAdmin) de um vínculo existente. */
  update(membership: MinistryMembership): Promise<MinistryMembership>;
  /** Remove o vínculo. */
  delete(id: string): Promise<void>;
}
