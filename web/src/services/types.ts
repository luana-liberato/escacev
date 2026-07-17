/**
 * Tipos do domínio como a API os SERIALIZA — não como as entidades existem no
 * back. A diferença que importa: `Date` vira string ISO no JSON, então aqui todo
 * campo de data é `string`. Converter para `Date` é da borda que formata.
 *
 * Nomes em inglês (Seção 4.6 da raiz). Os valores de enum gerados pelo Prisma
 * (`ADMIN_GERAL`, `RASCUNHO`...) viajam no wire em português e ficam como estão.
 */

/** Enum `PerfilUsuario` do Prisma — papel GLOBAL do membro. */
export type UserRole = 'ADMIN_GERAL' | 'ADMIN_MINISTERIO' | 'MEMBRO';

/** Enum `StatusEscala` do Prisma. RASCUNHO é invisível ao membro (RN04). */
export type ScheduleStatus = 'RASCUNHO' | 'PUBLICADA';

/** Tipos de evento — o domínio os define em inglês; o schema guarda em português. */
export type EventType = 'SERVICE' | 'REHEARSAL' | 'SPECIAL';

/** Tipos de notificação in-app. Convite não entra: é entrega e-mail-only. */
export type NotificationType =
  | 'ESCALADO'
  | 'INDISPONIBILIDADE_CONFLITO'
  | 'LEMBRETE'
  | 'TROCA'
  | 'SISTEMA';

/** Envelope de resposta da API (Seção 4.4 da raiz). Só o `http.ts` o enxerga. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

/** Payload do JWT emitido no callback do Google. */
export interface AuthUser {
  memberId: string;
  institutionId: string;
  role: UserRole;
}

/**
 * Projeção pública do membro. A API **omite** `accountId` (dado sensível de
 * vínculo com a Conta Google) e `institutionId` (implícito no tenant do JWT), e
 * acrescenta `pending` — derivado, sinaliza convite ainda não aceito (sem Conta
 * vinculada). Não são os campos da entidade do back: é o que atravessa o wire.
 */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  /** Convidado que ainda não fez o primeiro login com o Google. */
  pending: boolean;
  createdAt: string;
}

/** A API não serializa `institutionId` aqui — o tenant é implícito no JWT. */
export interface Ministry {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/**
 * Vínculo membro↔ministério. Existir = participa (é escalável); `isAdmin` =
 * também administra. A API não serializa o `id` do vínculo — a chave útil é o
 * par (memberId, ministryId).
 */
export interface MinistryMembership {
  memberId: string;
  ministryId: string;
  isAdmin: boolean;
  createdAt: string;
}

/** Membro de um ministério: projeção enxuta + o papel no vínculo. Sem `createdAt`. */
export interface MinistryMemberView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  pending: boolean;
  isAdmin: boolean;
  /** Quando o vínculo foi criado (`createdAt` da associação). */
  since: string;
}

/** Ministério de um membro: projeção enxuta + o papel no vínculo. */
export interface MemberMinistryView {
  id: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  since: string;
}

/** Função dentro de um ministério (model `Funcao`). */
export interface Position {
  id: string;
  name: string;
  ministryId: string;
  createdAt: string;
}

/** Par compatível. Ausência do par = INCOMPATÍVEL (RN02, o default). */
export interface PositionCompatibility {
  id: string;
  positionAId: string;
  positionBId: string;
  createdAt: string;
}

export interface Event {
  id: string;
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  institutionId: string;
  createdAt: string;
}

/** Escala de um ministério para um evento. `name: ''` é a escala padrão única (RN09). */
export interface Schedule {
  id: string;
  ministryId: string;
  eventId: string;
  name: string;
  status: ScheduleStatus;
  publishedAt: string | null;
  createdAt: string;
}

/** Alocação direta: membro + função na escala. `conflict` registra a sobrescrita ciente (RN03). */
export interface Assignment {
  id: string;
  scheduleId: string;
  memberId: string;
  positionId: string;
  conflict: boolean;
  createdAt: string;
}

/** Alocação no detalhe da escala: membro e função já resolvidos pelo back (sem N+1). */
export interface ScheduleAssignmentDetail {
  id: string;
  positionId: string;
  conflict: boolean;
  createdAt: string;
  member: { id: string; name: string };
  position: { id: string; name: string };
}

/** GET /escalas/:id — a escala + suas alocações com nomes resolvidos. */
export interface ScheduleWithAssignments extends Schedule {
  assignments: ScheduleAssignmentDetail[];
}

/** Uma alocação do membro no período, já com todos os nomes resolvidos. */
export interface MemberScheduleEntry {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  ministryId: string;
  ministryName: string;
  eventId: string;
  eventName: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  positionId: string;
  positionName: string;
}

/**
 * GET /minhas-escalas — o período consultado (já resolvido pelo back; mês
 * corrente por padrão) + as alocações do membro nele, de TODOS os ministérios e
 * só de escalas PUBLICADA (RN04).
 */
export interface MyScheduleResult {
  from: string;
  to: string;
  entries: MemberScheduleEntry[];
}

export interface Unavailability {
  id: string;
  memberId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  memberId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/**
 * Detalhe legível de UM conflito (RN01), com os nomes já resolvidos pelo back —
 * inclusive de ministérios que o admin não administra (decisão de produto:
 * transparência total).
 */
export interface ConflictDetail {
  assignmentId: string;
  memberName: string;
  scheduleId: string;
  ministryId: string;
  ministryName: string;
  eventId: string;
  eventName: string;
  positionId: string;
  positionName: string;
  startsAt: string;
  endsAt: string;
  /**
   * RN07: `true` quando a alocação EXISTENTE está numa escala publicada antes e
   * portanto prevalece — é o candidato que deveria ser ajustado. Metadado para o
   * admin decidir; não bloqueia nada.
   */
  existingHasPrecedence: boolean;
}

/** Um item do lote de alocação. `confirm` cobre conflito E indisponibilidade. */
export interface AssignmentItem {
  memberId: string;
  positionId: string;
  confirm?: boolean;
}

/** Item inválido: reenviar NÃO adianta. */
export interface FailedAssignment {
  item: AssignmentItem;
  reason: string;
}

/**
 * Item que disparou alerta e NÃO foi criado — reenviar o MESMO item com
 * `confirm: true` cria mesmo assim. Pelo menos uma das listas vem não-vazia.
 */
export interface NeedsConfirmationAssignment {
  item: AssignmentItem;
  conflicts: ConflictDetail[];
  unavailabilities: Unavailability[];
}

/**
 * Resultado do lote. Vem com HTTP 201 mesmo quando `created` está vazio —
 * `needsConfirmation` é "aguardando decisão do admin", não erro.
 */
export interface AddAssignmentsResult {
  created: Assignment[];
  failed: FailedAssignment[];
  needsConfirmation: NeedsConfirmationAssignment[];
}

/** Uma alocação da escala + os conflitos que ela dispara agora. */
export interface AssignmentConflicts {
  assignment: ScheduleAssignmentDetail;
  conflicts: ConflictDetail[];
}

/**
 * GET /escalas/:id/conflitos — a escala + APENAS as alocações em conflito,
 * reavaliadas AO VIVO (read-only, nada é gravado).
 *
 * Difere da flag `conflict` persistida na alocação: aquela registra a decisão
 * ciente do admin no momento da criação (RN03); esta acusa também o que surgiu
 * DEPOIS (outra escala sobreposta, ou a matriz de compatibilidade mudou). É a
 * visão de revisão antes de publicar.
 */
export interface ScheduleConflictsResult extends Schedule {
  conflicts: AssignmentConflicts[];
}
