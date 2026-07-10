import { PositionCompatibility } from '../entities/PositionCompatibility';

/**
 * Abstração de persistência da matriz de compatibilidade entre funções
 * (PositionCompatibility). Use cases dependem desta interface, nunca do
 * PrismaClient direto (Seção 4.2).
 *
 * A FORMA CANÔNICA (positionAId < positionBId, RN02) é aplicada SEMPRE na
 * fronteira do repositório: findByPair e delete ordenam os dois ids antes de
 * operar, então nenhum caller precisa se preocupar com a ordem em que passa o par.
 */
export interface PositionCompatibilityRepository {
  /**
   * Busca a linha canônica do par (ordena os dois ids antes de buscar).
   * null quando não existe — ou seja, funções incompatíveis por padrão (RN02).
   */
  findByPair(
    positionId1: string,
    positionId2: string,
  ): Promise<PositionCompatibility | null>;
  /** Persiste um novo par compatível (já em forma canônica pela entidade). */
  save(compatibility: PositionCompatibility): Promise<PositionCompatibility>;
  /**
   * Remove a linha canônica do par (ordena os dois ids antes). Retorna true se
   * removeu alguma linha, false se o par não existia — deixa o use case decidir
   * a semântica (idempotente vs. 404) sem estourar erro do Prisma.
   */
  delete(positionId1: string, positionId2: string): Promise<boolean>;
  /**
   * Todos os pares compatíveis da instituição (via funções → ministérios), em
   * ordem de criação. Para a tela de matriz no frontend futuramente.
   */
  listByInstitution(institutionId: string): Promise<PositionCompatibility[]>;
}
