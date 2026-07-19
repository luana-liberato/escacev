import { Schedule } from '../entities/Schedule';

/**
 * Abstração de persistência da escala (Schedule). Use cases dependem desta
 * interface, nunca do PrismaClient direto (Seção 4.2).
 *
 * ATENÇÃO AO TENANT: o model `Escala` NÃO tem coluna de instituição — pertence a
 * um Ministerio e a um Evento, e ambos é que têm `instituicaoId`. Por isso as
 * buscas por instituição são filtradas pela RELAÇÃO com o ministério
 * (`ministerio.instituicaoId`), garantindo o isolamento por tenant.
 */
export interface ScheduleRepository {
  /** Escala por id (sem escopo — o use case valida o tenant via ministério). */
  findById(id: string): Promise<Schedule | null>;
  /**
   * Escala específica pela chave única (ministério, evento, dia, nome) — usada
   * para checar duplicata (409). nome = "" busca a escala padrão do ministério
   * NAQUELE dia; `day = null` busca a escala sem dia fixado (legada/um dia).
   */
  findByMinistryEventDayAndName(
    ministryId: string,
    eventId: string,
    day: Date | null,
    name: string,
  ): Promise<Schedule | null>;
  /**
   * Todas as escalas de um ministério para um evento (uma por rótulo/sala) —
   * alimenta o List quando os dois filtros são combinados.
   */
  findByMinistryAndEvent(ministryId: string, eventId: string): Promise<Schedule[]>;
  /** Escalas de um evento (todos os ministérios), no escopo da instituição. */
  findByEvent(eventId: string, institutionId: string): Promise<Schedule[]>;
  /** Escalas de um ministério (vários eventos), no escopo da instituição. */
  findByMinistry(ministryId: string, institutionId: string): Promise<Schedule[]>;
  /** Todas as escalas da instituição (List sem filtro). */
  findByInstitution(institutionId: string): Promise<Schedule[]>;
  /** Persiste uma nova escala. */
  save(schedule: Schedule): Promise<Schedule>;
  /**
   * Persiste alterações de estado de uma escala existente (ex.: publicação —
   * `status` + `publicadaEm`). Não altera o trio identitário (ministério, evento).
   */
  update(schedule: Schedule): Promise<Schedule>;
  /**
   * Remove a escala. Hoje a escala nasce vazia, então é uma remoção simples.
   * Quando existirem alocações (bloco seguinte da Fase 5), esta remoção deve
   * passar a apagar em transação as `Alocacao` da própria escala — elas são o
   * corpo da escala, não histórico compartilhado (diferente do delete de Evento,
   * que bloqueia). Ponto de evolução deixado isolado aqui.
   */
  delete(id: string): Promise<void>;
}
