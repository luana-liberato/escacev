import { http } from './http';
import type { Ministry } from './types';

/**
 * Ministérios. Referência do padrão de `services/`: a rota é PT (`/ministerios`),
 * o que sai daqui é EN e já desembrulhado — a tela nunca vê o envelope.
 *
 * RBAC (o back decide, o front só reage): criar e remover são escopo de
 * INSTITUIÇÃO → só ADMIN_GERAL (403 caso contrário). Editar é escopo de
 * MINISTÉRIO → ADMIN_GERAL ou ADMIN_MINISTERIO com isAdmin naquele ministério,
 * checado pela guarda no back (403 caso contrário). Não replicar essa regra aqui.
 */

export interface CreateMinistryInput {
  name: string;
  description?: string | null;
}

export interface UpdateMinistryInput {
  name?: string;
  description?: string | null;
}

export function listMinistries(): Promise<Ministry[]> {
  return http.get<Ministry[]>('/ministerios');
}

export function getMinistry(id: string): Promise<Ministry> {
  return http.get<Ministry>(`/ministerios/${id}`);
}

/** 409 se já existir ministério com o mesmo nome na instituição. */
export function createMinistry(input: CreateMinistryInput): Promise<Ministry> {
  return http.post<Ministry>('/ministerios', input);
}

/** 409 no nome duplicado; 403 se não for admin DESTE ministério. */
export function updateMinistry(id: string, input: UpdateMinistryInput): Promise<Ministry> {
  return http.put<Ministry>(`/ministerios/${id}`, input);
}

/**
 * Remoção em cascata do que é ESTRUTURAL (funções e vínculos). Responde 409 quando
 * há histórico a preservar: escalas do ministério ou funções já usadas em alocação.
 * A `message` do ApiError explica qual dos dois — vale exibi-la ao usuário.
 */
export function removeMinistry(id: string): Promise<null> {
  return http.del<null>(`/ministerios/${id}`);
}
