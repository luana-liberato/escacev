import { Assignment } from '../entities/Assignment';

/**
 * Abstração de persistência da alocação (Assignment). Use cases dependem desta
 * interface, nunca do PrismaClient direto (Seção 4.2). Escopo por instituição é
 * garantido no use case, via a escala (que por sua vez deriva do ministério).
 *
 * Métodos de listagem entram no próximo incremento (controller/rotas).
 */
export interface AssignmentRepository {
  /** Alocação por id (sem escopo — o use case valida o tenant via escala/ministério). */
  findById(id: string): Promise<Assignment | null>;
  /** Persiste uma nova alocação. */
  save(assignment: Assignment): Promise<Assignment>;
  /** Atualiza memberId e/ou positionId de uma alocação existente. */
  update(assignment: Assignment): Promise<Assignment>;
  /** Remove a alocação. */
  delete(id: string): Promise<void>;
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
