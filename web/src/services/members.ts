import { http } from './http';
import type { Member, UserRole } from './types';

/**
 * Membros. RBAC (o back decide, o front só reage): listar e convidar exigem
 * admin; atualizar é exclusivo do ADMIN_GERAL; os próprios dados são abertos a
 * qualquer perfil.
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

/** Corrige o próprio nome. Qualquer perfil — só o nome, nunca perfil ou status. */
export function updateMyName(name: string): Promise<Member> {
  return http.patch<Member>('/membros/me', { name });
}

/**
 * Todos os membros da instituição. Exige admin, e **não filtra por ministério** —
 * a lista do ADMIN_MINISTERIO sai por `listMinistryMembers` (memberships.ts),
 * que é escopada no servidor.
 */
export function listMembers(): Promise<Member[]> {
  return http.get<Member[]>('/membros');
}

export interface InviteMemberInput {
  name: string;
  email: string;
  role?: UserRole;
}

/**
 * Convite no nível da INSTITUIÇÃO, com o perfil escolhido — o convite do
 * ADMIN_GERAL. 409 no e-mail duplicado.
 *
 * O ADMIN_MINISTERIO usa outro caminho (`inviteToMinistry`): o dele é sempre
 * escopado no ministério e não escolhe perfil.
 */
export function inviteMember(input: InviteMemberInput): Promise<Member> {
  return http.post<Member>('/membros', input);
}

export interface UpdateMemberInput {
  name?: string;
  role?: UserRole;
  active?: boolean;
}

/**
 * Atualiza um membro — **exclusivo do ADMIN_GERAL** (403 caso contrário).
 * E-mail não está aqui: a API nunca permitiu alterá-lo (é a chave que liga o
 * convite à conta Google).
 */
export function updateMember(id: string, input: UpdateMemberInput): Promise<Member> {
  return http.put<Member>(`/membros/${id}`, input);
}
