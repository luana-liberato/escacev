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
 * Um vínculo desejado: participar de um ministério e, opcionalmente, administrá-lo.
 * É a forma que a tela edita — os dois são a mesma decisão do admin.
 */
export interface MemberMinistryLink {
  ministryId: string;
  isAdmin: boolean;
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
  /**
   * Define os vínculos de um membro como EXATAMENTE `links`, numa transação —
   * remove os que saíram, cria os que entraram e ajusta o `isAdmin` dos que
   * mudaram de papel. Ou tudo, ou nada.
   *
   * Existe porque a tela edita o conjunto inteiro de uma vez: fazer o diff no
   * cliente e disparar N chamadas deixaria o membro meio-associado se uma delas
   * falhasse, sem como desfazer as anteriores.
   *
   * A lista é a FONTE DA VERDADE, inclusive do `isAdmin` — participar de um
   * ministério e administrá-lo são a mesma edição na tela, então precisam ser a
   * mesma escrita aqui. Vínculo que permanece com o mesmo papel não é tocado.
   */
  replaceForMember(memberId: string, links: MemberMinistryLink[]): Promise<void>;
}
