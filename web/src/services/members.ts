import { http } from './http';
import type { Member } from './types';

/**
 * Membros. RBAC (o back decide, o front só reage): listar e ver exigem admin;
 * atualizar é exclusivo do ADMIN_GERAL.
 */

/**
 * Os dados do próprio usuário autenticado. Member-scoped: sem parâmetro — o id
 * vem do JWT.
 *
 * Existe porque o JWT carrega só `{ memberId, institutionId, role }` — sem o
 * nome — e `GET /membros/:id` exige admin. Sem esta rota, um MEMBRO não
 * conseguiria ler o próprio cadastro.
 */
export function getMyMember(): Promise<Member> {
  return http.get<Member>('/membros/me');
}

export function listMembers(): Promise<Member[]> {
  return http.get<Member[]>('/membros');
}
