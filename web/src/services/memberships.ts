import { http } from './http';
import type { MemberMinistryView, MinistryMemberView } from './types';

/**
 * Vínculo membro↔ministério. Existir = participa (é escalável); `isAdmin` = também
 * administra aquele ministério.
 */

/**
 * Membros de um ministério, já com o papel no vínculo.
 *
 * É por AQUI que a tela de Membros lista para o ADMIN_MINISTERIO: `GET /membros`
 * devolve TODOS os membros da instituição, sem filtro por papel — filtrar no
 * front faria os dados dos outros trafegarem mesmo assim. Esta rota é escopada
 * no servidor.
 */
export function listMinistryMembers(ministryId: string): Promise<MinistryMemberView[]> {
  return http.get<MinistryMemberView[]>(`/ministerios/${ministryId}/membros`);
}

/** Ministérios de um membro, com o `isAdmin` de cada vínculo. */
export function listMemberMinistries(memberId: string): Promise<MemberMinistryView[]> {
  return http.get<MemberMinistryView[]>(`/membros/${memberId}/ministerios`);
}

/** Um vínculo desejado: participar e, opcionalmente, administrar. */
export interface MemberMinistryLink {
  ministryId: string;
  isAdmin: boolean;
}

/**
 * Define os vínculos do membro como EXATAMENTE esta lista — o "salvar" dos chips
 * do modal. Manda a lista final; o servidor calcula o diff e aplica numa
 * transação. Lista vazia remove de todos.
 *
 * O `isAdmin` vai junto porque participar e administrar são a MESMA edição na
 * tela (o chip marca a participação, a marcação de admin promove) — e é o que
 * dá poder real a um ADMIN_MINISTERIO: sem `isAdmin` no vínculo, ele tem o perfil
 * global mas leva 403 da guarda escopada em toda ação.
 *
 * ⚠️ A lista é a FONTE DA VERDADE: mandar um vínculo sem `isAdmin` REBAIXA quem
 * era admin. Por isso o modal precisa partir do estado real, nunca de um padrão.
 *
 * ADMIN_GERAL apenas (403 caso contrário): mexer nos ministérios de alguém
 * atravessa ministérios, e isso é escopo de instituição.
 */
export function setMemberMinistries(
  memberId: string,
  ministries: MemberMinistryLink[],
): Promise<MemberMinistryView[]> {
  return http.put<MemberMinistryView[]>(`/membros/${memberId}/ministerios`, { ministries });
}

/**
 * Promove ou rebaixa o admin de UM vínculo. É o caminho do botão "Promover" do
 * admin de grupo — escopado: `ADMIN_GERAL`, ou `ADMIN_MINISTERIO` com `isAdmin`
 * NAQUELE ministério (403 caso contrário, pela MinistryAccessPolicy).
 *
 * A API deriva o perfil junto: promover aqui torna a pessoa ADMIN_MINISTERIO.
 * Sem isso ela ganharia o `isAdmin` e continuaria barrada pelo `rbac`.
 */
export function setMembershipAdmin(
  ministryId: string,
  memberId: string,
  isAdmin: boolean,
): Promise<unknown> {
  return http.patch(`/ministerios/${ministryId}/membros/${memberId}/admin`, { isAdmin });
}

export interface InviteToMinistryInput {
  name: string;
  email: string;
  isAdmin?: boolean;
}

/**
 * Convite ESCOPADO no ministério — é por aqui que o ADMIN_MINISTERIO convida.
 * Faz criar-ou-associar: e-mail novo cria o Membro (perfil MEMBRO) e associa;
 * e-mail existente fora do ministério só associa; já no ministério → 409.
 *
 * Diferente do `inviteMember` (POST /membros), que é do ADMIN_GERAL e cria no
 * nível da instituição com o perfil escolhido. O admin de ministério nunca cria
 * membro "solto" e não escolhe perfil (Seção 1 do CLAUDE.md).
 */
export function inviteToMinistry(
  ministryId: string,
  input: InviteToMinistryInput,
): Promise<unknown> {
  return http.post(`/ministerios/${ministryId}/membros/convite`, input);
}
