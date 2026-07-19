import { http } from './http';
import type { Schedule, ScheduleWithAssignments, ScheduleConflictsResult } from './types';

/**
 * Escalas (Schedule) — a casca de um ministério para um evento, preenchida com
 * alocações. RBAC (o back decide, o front reage): criar/publicar/remover são
 * escopo de ministério (ADMIN_GERAL, ou admin daquele ministério — 403 caso
 * contrário); listar/ver/conflitos são abertos aos dois admins. O MEMBRO não
 * alcança estas rotas (a visão dele é GET /minhas-escalas, na Agenda).
 *
 * Datas viajam como string ISO. A escala não tem data própria — herda a do evento
 * (resolvido no cliente pela lista de eventos).
 */

/** Lista as escalas da instituição (a API devolve a escala "crua", sem nomes/alocações). */
export function listSchedules(): Promise<Schedule[]> {
  return http.get<Schedule[]>('/escalas');
}

/** Uma escala com suas alocações (nomes de pessoa/função já resolvidos pelo back). */
export function getSchedule(id: string): Promise<ScheduleWithAssignments> {
  return http.get<ScheduleWithAssignments>(`/escalas/${id}`);
}

export interface CreateScheduleInput {
  ministryId: string;
  eventId: string;
  /** Rótulo da salinha; vazio/omitido = escala única do ministério (RN09). */
  name?: string;
  /** Dia do evento a que a escala se refere ("YYYY-MM-DD") — fixa o dia em multi-dia. */
  date?: string;
}

/** Cria a escala vazia (RASCUNHO). 409 no trio duplicado (ministério, evento, nome). */
export function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  return http.post<Schedule>('/escalas', input);
}

/** Publica a escala (RASCUNHO → PUBLICADA). 409 se já publicada; notifica os escalados. */
export function publishSchedule(id: string): Promise<Schedule> {
  return http.patch<Schedule>(`/escalas/${id}/publicar`);
}

/** Remove a escala (escopo de ministério). */
export function removeSchedule(id: string): Promise<null> {
  return http.del<null>(`/escalas/${id}`);
}

/** Reavalia AO VIVO os conflitos das alocações da escala (read-only, nada é gravado). */
export function getScheduleConflicts(id: string): Promise<ScheduleConflictsResult> {
  return http.get<ScheduleConflictsResult>(`/escalas/${id}/conflitos`);
}
