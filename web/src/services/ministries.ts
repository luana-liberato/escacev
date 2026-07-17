import { http } from './http';
import type { Ministry } from './types';

/**
 * Ministérios. Referência do padrão de `services/`: rota em PT, saída em EN e já
 * desembrulhada — a tela nunca vê o envelope.
 *
 * RBAC (o back decide, o front reage): criar e remover são escopo de INSTITUIÇÃO
 * (só ADMIN_GERAL, 403 caso contrário); editar é escopo de MINISTÉRIO (guarda no
 * back). Não replicar essa regra aqui.
 */

/** Um administrador de um ministério, para a linha "Administradores:" do card. */
export interface MinistryCardAdmin {
  id: string;
  name: string;
}

/** O que cada card da tela de Ministérios precisa, já pronto pela API. */
export interface MinistryCard {
  id: string;
  name: string;
  description: string | null;
  admins: MinistryCardAdmin[];
  /** true = o usuário logado administra ESTE ministério (badge "Você administra"). */
  isCurrentUserAdmin: boolean;
}

/**
 * Read model da tela de Ministérios, escopado por papel — a fonte da tela.
 *
 * É por AQUI que o MEMBRO vê ministérios: os demais endpoints de `/ministerios`
 * são admin-only. O escopo (todos, ou só os que participo) é decidido no
 * servidor, então o front não filtra nada.
 */
export function listMinistryCards(): Promise<MinistryCard[]> {
  return http.get<MinistryCard[]>('/ministerios/cards');
}

/**
 * Lista CRUA de ministérios da instituição (`GET /ministerios`), admin-only.
 * Usada pela tela de Membros (chips do modal, filtros) — não pela de Ministérios,
 * que usa o read model dos cards acima.
 */
export function listMinistries(): Promise<Ministry[]> {
  return http.get<Ministry[]>('/ministerios');
}

export interface CreateMinistryInput {
  name: string;
  description?: string | null;
}

/** 409 se já existir ministério com o mesmo nome na instituição. */
export function createMinistry(input: CreateMinistryInput): Promise<Ministry> {
  return http.post<Ministry>('/ministerios', input);
}

/** 409 no nome duplicado; 403 se não for admin DESTE ministério. */
export function updateMinistry(id: string, input: CreateMinistryInput): Promise<Ministry> {
  return http.put<Ministry>(`/ministerios/${id}`, input);
}
