import { Assignment } from '../entities/Assignment';

/**
 * Abstração de persistência da alocação (Assignment). Use cases dependem desta
 * interface, nunca do PrismaClient direto (Seção 4.2). Escopo por instituição é
 * garantido no use case, via a escala (que por sua vez deriva do ministério).
 *
 * Mínimo necessário para o incremento de ADICIONAR alocações — métodos de
 * editar/remover/listar entram nos próximos incrementos.
 */
export interface AssignmentRepository {
  /** Persiste uma nova alocação. */
  save(assignment: Assignment): Promise<Assignment>;
  /**
   * true se já existe alocação dessa pessoa nessa função nessa escala — checagem
   * de duplicata (mapeia @@unique([escalaId, membroId, funcaoId])).
   */
  existsByScheduleMemberPosition(
    scheduleId: string,
    memberId: string,
    positionId: string,
  ): Promise<boolean>;
}
