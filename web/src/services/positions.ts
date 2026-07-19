import { http } from './http';
import type { Position } from './types';

/**
 * Funções (Position). RBAC (o back decide, o front reage): criar/editar/remover
 * são escopo de ministério (ADMIN_GERAL, ou admin daquele ministério — 403
 * caso contrário); leitura aberta aos dois admins.
 */

/** Uma função da instituição, já com o nome do ministério (do read model). */
export interface InstitutionPosition {
  id: string;
  name: string;
  ministryId: string;
  ministryName: string;
}

/**
 * Catálogo de TODAS as funções da instituição, com o nome do ministério. É a
 * fonte da tela de Funções — a lista e os toggles de compatibilidade (que mostram
 * todas as funções, não só as do escopo do admin de grupo).
 */
export function listInstitutionPositions(): Promise<InstitutionPosition[]> {
  return http.get<InstitutionPosition[]>('/funcoes');
}

/** Funções de UM ministério (para os seletores de alocação da escala). */
export function listMinistryPositions(ministryId: string): Promise<Position[]> {
  return http.get<Position[]>(`/ministerios/${ministryId}/funcoes`);
}

/** Cria uma função dentro de um ministério. 409 no nome duplicado no ministério. */
export function createPosition(ministryId: string, name: string): Promise<Position> {
  return http.post<Position>(`/ministerios/${ministryId}/funcoes`, { name });
}

/** Edita o nome de uma função. 403 se não for admin do ministério dela. */
export function updatePosition(id: string, name: string): Promise<Position> {
  return http.put<Position>(`/funcoes/${id}`, { name });
}

/** Remove uma função. 409 se estiver em uso em escalas/alocações. */
export function removePosition(id: string): Promise<null> {
  return http.del<null>(`/funcoes/${id}`);
}
