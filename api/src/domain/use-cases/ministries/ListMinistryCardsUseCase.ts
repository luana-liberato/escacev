import { PerfilUsuario } from '@prisma/client';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';

/** Um administrador de um ministério, para a linha "Administradores:" do card. */
export interface MinistryCardAdmin {
  id: string;
  name: string;
}

/** O que cada card da tela de Ministérios precisa, já pronto. */
export interface MinistryCard {
  id: string;
  name: string;
  description: string | null;
  admins: MinistryCardAdmin[];
  /** true = o usuário logado administra ESTE ministério (badge "Você administra"). */
  isCurrentUserAdmin: boolean;
}

export interface ListMinistryCardsDTO {
  institutionId: string;
  memberId: string;
  role: PerfilUsuario;
}

/**
 * Read model da tela de Ministérios (cards) — escopado por papel, numa chamada só.
 *
 * Existe porque a tela serve os TRÊS atores e o `GET /ministerios` cru não basta:
 * é admin-only (o MEMBRO levaria 403) e não traz quem administra cada ministério.
 * Este endpoint é `auth`-only e faz a checagem de escopo aqui dentro.
 *
 * Quem vê o quê:
 * - ADMIN_GERAL → todos os ministérios da instituição.
 * - demais → só os ministérios de que PARTICIPA (administrando ou só escalado).
 *   Um MEMBRO enxerga a tela, mas só os seus.
 *
 * `isCurrentUserAdmin` vem de administrar de fato o ministério (isAdmin no
 * vínculo), não do papel global — um ADMIN_GERAL que não tenha vínculo de admin
 * num ministério específico não recebe o badge "Você administra" nele, igual ao
 * protótipo.
 *
 * A busca de administradores reusa `findMembersByMinistry` por ministério visível:
 * é server-side, numa requisição, e o N é o número de ministérios que o usuário
 * vê — poucos numa igreja. Não alarga a interface do repositório.
 */
export class ListMinistryCardsUseCase {
  constructor(
    private readonly ministryRepo: MinistryRepository,
    private readonly membershipRepo: MinistryMembershipRepository,
  ) {}

  async execute(dto: ListMinistryCardsDTO): Promise<MinistryCard[]> {
    const visible =
      dto.role === 'ADMIN_GERAL'
        ? await this.ministryRepo.findByInstitution(dto.institutionId)
        : (await this.membershipRepo.findMinistriesByMember(dto.memberId)).map(
            (view) => view.ministry,
          );

    const cards: MinistryCard[] = [];
    for (const ministry of visible) {
      const members = await this.membershipRepo.findMembersByMinistry(ministry.id);
      const admins = members
        .filter((view) => view.membership.isAdmin)
        .map((view) => ({ id: view.member.id, name: view.member.name }));

      cards.push({
        id: ministry.id,
        name: ministry.name,
        description: ministry.description,
        admins,
        isCurrentUserAdmin: admins.some((admin) => admin.id === dto.memberId),
      });
    }

    return cards;
  }
}
