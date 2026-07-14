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
 * Uma alocação existente do membro, já com o horário do evento, o ministério e
 * os nomes legíveis (membro/função/ministério) resolvidos — alimenta o
 * ConflictDetectionService (motor de conflito, RN01) e, por tabela, o
 * ConflictDetail que chega ao admin (incremento 3a: transparência total, sem
 * filtragem por papel). A varredura é institution-wide (via o próprio membro,
 * que já é escopado por instituição) e cross-ministério: não filtra por um
 * ministério específico. Como a busca é sempre `WHERE membroId = memberId`,
 * `memberName` repete o mesmo valor em todo o resultado (é sempre o membro
 * sendo alocado/editado) — incluído mesmo assim para o ConflictDetail ser
 * autossuficiente (o front não precisa resolver esse id à parte).
 */
export interface MemberAssignmentContext {
  assignmentId: string;
  memberName: string;
  scheduleId: string;
  ministryId: string;
  ministryName: string;
  eventId: string;
  eventName: string;
  positionId: string;
  positionName: string;
  startsAt: Date;
  endsAt: Date;
}

/** Intervalo [from, to] fechado, usado para recortar a visão do membro por período. */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Uma alocação do membro já pronta para a "visão do membro" (GET /minhas-escalas)
 * — evento, ministério, função e rótulo da escala resolvidos numa única consulta.
 * Só alocações de escalas PUBLICADA chegam aqui: rascunho é invisível ao membro
 * (RN04). É o espelho member-facing do detalhe que o admin vê, mas sem dado de
 * conflito (a resolução de conflito é do admin; a visão do membro é agenda).
 */
export interface MemberScheduleEntry {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  ministryId: string;
  ministryName: string;
  eventId: string;
  eventName: string;
  eventType: string;
  startsAt: Date;
  endsAt: Date;
  positionId: string;
  positionName: string;
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
  /**
   * Todas as alocações do membro (em qualquer ministério/escala), já com o
   * horário do evento — join numa única consulta (evita N+1 no motor de conflito).
   */
  findByMemberWithContext(memberId: string): Promise<MemberAssignmentContext[]>;
  /**
   * Alocações do membro em escalas **PUBLICADA** (RN04) cujo evento começa dentro
   * do intervalo, em qualquer ministério — alimenta a visão do membro
   * (GET /minhas-escalas). Ordenadas por início do evento (asc). Rascunho é
   * filtrado na origem: nunca chega ao membro.
   */
  findByMemberPublishedInRange(
    memberId: string,
    range: DateRange,
  ): Promise<MemberScheduleEntry[]>;
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
