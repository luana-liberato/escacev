import { http } from './http';

/** Um par compatível, na forma canônica (positionAId < positionBId). */
export interface CompatibilityPair {
  id: string;
  positionAId: string;
  positionBId: string;
  createdAt: string;
}

/**
 * Matriz de compatibilidade entre funções. Aberta ao ADMIN_GERAL e ao
 * ADMIN_MINISTERIO (que marca contra QUALQUER função da instituição — o par pode
 * cruzar ministérios).
 *
 * A relação é simétrica e o padrão é INCOMPATÍVEL: só existe par para o que foi
 * marcado; a ausência significa conflito.
 */
export function listCompatibilityPairs(): Promise<CompatibilityPair[]> {
  return http.get<CompatibilityPair[]>('/funcoes/compatibilidade');
}

/** Marca duas funções como compatíveis. Idempotente (remarcar é no-op). */
export function setCompatibility(positionAId: string, positionBId: string): Promise<unknown> {
  return http.post('/funcoes/compatibilidade', { positionAId, positionBId });
}

/** Remove a compatibilidade de um par. Idempotente (desmarcar o ausente é no-op). */
export function removeCompatibility(positionAId: string, positionBId: string): Promise<unknown> {
  return http.del('/funcoes/compatibilidade', { positionAId, positionBId });
}
