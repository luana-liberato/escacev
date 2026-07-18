import { http } from './http';
import type { Event, EventType } from './types';

/**
 * Eventos (Event) — calendário da instituição. RBAC (o back decide, o front
 * reage): criar, listar, editar e excluir são liberados aos dois admins
 * (ADMIN_GERAL e ADMIN_MINISTERIO); o MEMBRO leva 403. Evento é escopo de
 * INSTITUIÇÃO — não há guarda escopada por ministério.
 *
 * Datas viajam como string ISO (Seção 2 do CLAUDE.md do web). Converter de/para
 * os campos de data+hora do form é responsabilidade da borda da UI, não daqui.
 */

export interface EventInput {
  name: string;
  type: EventType;
  /** ISO 8601 — ex.: `new Date(...).toISOString()`. */
  startsAt: string;
  endsAt: string;
}

/** Lista todos os eventos da instituição (a API já devolve ordenado por início). */
export function listEvents(): Promise<Event[]> {
  return http.get<Event[]>('/eventos');
}

/** Cria um evento. 400 se o término não for depois do início. */
export function createEvent(input: EventInput): Promise<Event> {
  return http.post<Event>('/eventos', input);
}

/** Edita um evento. 400 no intervalo inválido. */
export function updateEvent(id: string, input: EventInput): Promise<Event> {
  return http.put<Event>(`/eventos/${id}`, input);
}

/** Remove um evento. 409 se houver escalas vinculadas (mensagem vem da API). */
export function removeEvent(id: string): Promise<null> {
  return http.del<null>(`/eventos/${id}`);
}
