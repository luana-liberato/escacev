import { Assignment } from '../entities/Assignment';
import { Member } from '../entities/Member';
import { Position } from '../entities/Position';

/**
 * Alocação de uma escala já com o membro e a função resolvidos — alimenta o
 * detalhe da escala (GetScheduleUseCase). Mesmo padrão de MinistryMemberView/
 * MemberMinistryView (MinistryMembershipRepository): par entidade + relacionados.
 */
export interface AssignmentDetail {
  assignment: Assignment;
  member: Member;
  position: Position;
}

/**
 * Abstração de persistência da alocação (Assignment). Use cases dependem desta
 * interface, nunca do PrismaClient direto (Seção 4.2). Escopo por instituição é
 * garantido no use case, via a escala (que por sua vez deriva do ministério).
 */
export interface AssignmentRepository {
  /** Alocação por id (sem escopo — o use case valida o tenant via escala/ministério). */
  findById(id: string): Promise<Assignment | null>;
  /**
   * Alocações de uma escala, já com membro e função resolvidos (join numa única
   * consulta — evita N+1 ao montar o detalhe da escala).
   */
  findByScheduleWithDetails(scheduleId: string): Promise<AssignmentDetail[]>;
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
