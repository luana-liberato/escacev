import { http } from './http';
import type { MyScheduleResult } from './types';

/**
 * Minhas escalas (GET /minhas-escalas) — as alocações do próprio membro no
 * período, só de escalas PUBLICADA (RN04), já com todos os nomes resolvidos.
 * `from`/`to` são ISO opcionais; sem eles a API usa o mês corrente.
 */
export function getMySchedule(from?: string, to?: string): Promise<MyScheduleResult> {
  return http.get<MyScheduleResult>('/minhas-escalas', { from, to });
}
