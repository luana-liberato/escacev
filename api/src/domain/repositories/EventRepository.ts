import { Event } from '../entities/Event';

/**
 * Janela opcional para filtrar eventos por período. Semântica de SOBREPOSIÇÃO
 * com o intervalo [from, to]: um evento entra se termina em/depois de `from` e
 * começa em/antes de `to` — assim a agenda mensal/semanal pega também eventos que
 * cruzam a borda da janela. Ambos os limites são opcionais.
 */
export interface EventDateRange {
  from?: Date;
  to?: Date;
}

/**
 * Abstração de persistência dos eventos (Event). Use cases dependem desta
 * interface, nunca do PrismaClient direto (Seção 4.2). O escopo por instituição
 * é garantido recebendo o institutionId (vindo do JWT no controller).
 */
export interface EventRepository {
  /** Evento por id (sem filtro de tenant — o use case valida a instituição). */
  findById(id: string): Promise<Event | null>;
  /** Eventos da instituição, em ordem cronológica; filtro por período opcional. */
  findByInstitution(institutionId: string, range?: EventDateRange): Promise<Event[]>;
  /** Persiste um novo evento. */
  save(event: Event): Promise<Event>;
  /** Atualiza nome, tipo e horários de um evento existente. */
  update(event: Event): Promise<Event>;
  /** Remove o evento (o use case bloqueia antes se houver escalas vinculadas). */
  delete(id: string): Promise<void>;
  /** Quantas escalas estão vinculadas ao evento (bloqueio de remoção). */
  countSchedules(eventId: string): Promise<number>;
}
