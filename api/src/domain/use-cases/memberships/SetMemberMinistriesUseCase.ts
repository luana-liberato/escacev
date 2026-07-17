import { PerfilUsuario } from '@prisma/client';
import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import {
  MemberMinistryLink,
  MemberMinistryView,
  MinistryMembershipRepository,
} from '../../repositories/MinistryMembershipRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface SetMemberMinistriesDTO {
  institutionId: string;
  memberId: string;
  /** A lista FINAL de vínculos. Vazia é válida: remove o membro de todos. */
  ministries: unknown;
}

/**
 * Define os vínculos de um membro como exatamente esta lista — o "salvar" dos
 * chips do modal de edição.
 *
 * Cada item traz `{ ministryId, isAdmin }`: participar de um ministério e
 * administrá-lo são a MESMA edição na tela (o chip marca a participação, a
 * marcação de admin promove), então precisam ser a mesma escrita. Fossem duas
 * chamadas, marcar alguém como admin poderia gravar metade.
 *
 * O front manda a lista final e não calcula diff nenhum: quem descobre o que
 * mudou é o servidor, e aplica numa transação (`replaceForMember`).
 *
 * ESCOPO DE INSTITUIÇÃO (ADMIN_GERAL apenas, garantido pelo rbac da rota): mexer
 * nos ministérios de alguém ATRAVESSA ministérios, e um ADMIN_MINISTERIO não pode
 * tirar ninguém de um ministério que ele não administra (Seção 1 do CLAUDE.md).
 * Por isso não usa a MinistryAccessPolicy — não há um ministério só para escopar.
 *
 * ⚠️ A lista é a FONTE DA VERDADE do `isAdmin`. Mandar um vínculo com
 * `isAdmin: false` REBAIXA quem era admin — é o comportamento desejado (a tela
 * mostra o estado atual e o admin decide), mas significa que um GET desatualizado
 * seguido de um PUT rebaixa sem querer. A tela precisa partir do estado real.
 */
export class SetMemberMinistriesUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly memberRepo: MemberRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: SetMemberMinistriesDTO): Promise<MemberMinistryView[]> {
    const member = await this.memberRepo.findById(dto.memberId);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    const links = SetMemberMinistriesUseCase.normalize(dto.ministries);

    // Cada ministério precisa existir E ser do mesmo tenant — senão um id de
    // outra instituição criaria um vínculo cruzando o isolamento.
    for (const link of links) {
      const ministry = await this.ministryRepo.findById(link.ministryId);
      if (!ministry || ministry.institutionId !== dto.institutionId) {
        throw new AppError(`Ministério não encontrado: ${link.ministryId}`, 404);
      }
    }

    await this.membershipRepo.replaceForMember(member.id, links);
    await this.deriveRole(member, links);

    return this.membershipRepo.findMinistriesByMember(member.id);
  }

  /**
   * O perfil ADMIN_MINISTERIO é DERIVADO, nunca escolhido: administra pelo menos
   * um ministério → é admin de grupo; nenhum → é membro.
   *
   * Por que derivar em vez de deixar no select da tela: "administrador de grupo"
   * não diz de QUAL grupo. Fossem duas fontes (o select e os chips), elas
   * poderiam discordar — alguém com perfil MEMBRO e isAdmin no Louvor ficaria
   * barrado pelo `rbac` antes da guarda escopada rodar, e o banco diria que ele
   * administra. Com uma fonte só, a contradição é impossível.
   *
   * O ADMIN_GERAL é a exceção e não é tocado: o poder dele é da INSTITUIÇÃO e não
   * vem de vínculo nenhum. Ele pode participar de ministérios (é escalável, Seção
   * 1 do CLAUDE.md) sem que isso mexa no seu perfil.
   */
  private async deriveRole(member: Member, links: MemberMinistryLink[]): Promise<void> {
    if (member.role === 'ADMIN_GERAL') return;

    const derived: PerfilUsuario = links.some((link) => link.isAdmin)
      ? 'ADMIN_MINISTERIO'
      : 'MEMBRO';
    if (derived === member.role) return;

    await this.memberRepo.update(member.update({ role: derived }));
  }

  /**
   * Valida a forma da lista e remove duplicatas de ministério — mandar o mesmo id
   * duas vezes é erro do cliente, não motivo para estourar a constraint @@unique
   * lá embaixo. Em duplicata, o ÚLTIMO vence (o cliente mandou os dois; o mais
   * recente é a intenção mais provável).
   */
  private static normalize(ministries: unknown): MemberMinistryLink[] {
    if (!Array.isArray(ministries)) {
      throw new AppError('ministries deve ser uma lista de vínculos', 400);
    }

    const byMinistry = new Map<string, MemberMinistryLink>();
    for (const item of ministries) {
      const ministryId = (item as { ministryId?: unknown })?.ministryId;
      const isAdmin = (item as { isAdmin?: unknown })?.isAdmin;

      if (typeof ministryId !== 'string' || !ministryId.trim()) {
        throw new AppError('Cada vínculo precisa de um ministryId válido', 400);
      }
      if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
        throw new AppError('isAdmin deve ser um booleano', 400);
      }

      byMinistry.set(ministryId.trim(), { ministryId: ministryId.trim(), isAdmin: isAdmin === true });
    }

    return [...byMinistry.values()];
  }
}
