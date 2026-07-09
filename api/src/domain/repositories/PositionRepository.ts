import { Position } from '../entities/Position';

/**
 * Abstração de persistência das funções (Position). Use cases dependem desta
 * interface, nunca do PrismaClient direto (Seção 4.2). O escopo por instituição
 * é garantido nos use cases (via o ministério dono da função).
 */
export interface PositionRepository {
  /** Função por id (sem escopo — o use case valida o tenant via ministério). */
  findById(id: string): Promise<Position | null>;
  /** Funções de um ministério, em ordem de criação. */
  findByMinistry(ministryId: string): Promise<Position[]>;
  /** Função com o mesmo nome dentro do ministério (regra de duplicidade). */
  findByNameInMinistry(ministryId: string, name: string): Promise<Position | null>;
  /** Persiste uma nova função. */
  save(position: Position): Promise<Position>;
  /** Atualiza o nome de uma função existente. */
  update(position: Position): Promise<Position>;
  /** Remove a função (com cascata das compatibilidades — ver implementação). */
  delete(id: string): Promise<void>;
  /** Quantas vagas de evento usam esta função (bloqueio de remoção). */
  countEventSlotUsage(id: string): Promise<number>;
}
