import { AssignmentRepository } from '../repositories/AssignmentRepository';
import { CheckPositionCompatibilityUseCase } from '../use-cases/position-compatibilities/CheckPositionCompatibilityUseCase';

/** A nova alocação que se avalia (ainda não persistida). */
export interface ConflictCheckInput {
  memberId: string;
  positionId: string;
  startsAt: Date;
  endsAt: Date;
  /**
   * Ignora esta alocação existente na varredura — usado pelo fluxo de EDIÇÃO
   * (incremento futuro): a própria alocação sendo editada não deve conflitar
   * consigo mesma.
   */
  excludeAssignmentId?: string;
}

/**
 * Detalhe de UMA alocação existente que conflita com a nova — inclui os nomes
 * legíveis (membro/função/ministério/evento) para o admin entender o conflito
 * sem o front precisar resolver ids (incremento 3a). Transparência total: sem
 * filtragem por papel, mesmo para ministério que o admin não administra.
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
  startsAt: Date;
  endsAt: Date;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

/**
 * Motor de detecção de conflito (RN01) — FUNÇÃO DE CONSULTA PURA: recebe os
 * dados e responde se há conflito e quais. NÃO cria, NÃO bloqueia, NÃO grava
 * nada, NÃO mexe na flag `conflict` — quem age com base na resposta é o fluxo
 * de alocação (incremento seguinte). Dado o mesmo input, mesmo output.
 *
 * RN01 — é conflito quando AMBAS as condições valem, para cada alocação
 * existente do membro:
 *  1. SOBREPOSIÇÃO de horário: novo.inicio < existente.fim E novo.fim > existente.inicio
 *     (estrito — limites que só se tocam NÃO contam como sobreposição);
 *  2. Funções INCOMPATÍVEIS (via CheckPositionCompatibilityUseCase, RN02 —
 *     ausência de par = incompatível; mesma função também devolve incompatível).
 *
 * A varredura é CENTRADA NO MEMBRO, institution-wide e cross-ministério (RN09):
 * não filtra por ministério nem por escala — inclusive múltiplas escalas do
 * MESMO ministério no mesmo evento entram na comparação, sem isenção.
 *
 * Dependências injetadas via construtor (Seção 4.2): reusa o
 * CheckPositionCompatibilityUseCase já existente (não reimplementa
 * compatibilidade) e o AssignmentRepository para buscar as alocações do membro.
 */
export class ConflictDetectionService {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly checkCompatibility: CheckPositionCompatibilityUseCase,
  ) {}

  async check(input: ConflictCheckInput): Promise<ConflictCheckResult> {
    const existingAssignments = await this.assignmentRepo.findByMemberWithContext(input.memberId);

    const conflicts: ConflictDetail[] = [];

    for (const existing of existingAssignments) {
      if (existing.assignmentId === input.excludeAssignmentId) continue;

      const overlaps = ConflictDetectionService.overlaps(input, existing);
      if (!overlaps) continue; // sem sobreposição: nunca é conflito (RN01), pula o Check

      const compatible = await this.checkCompatibility.execute(input.positionId, existing.positionId);
      if (compatible) continue; // sobrepõe, mas funções compatíveis: não é conflito

      conflicts.push({
        assignmentId: existing.assignmentId,
        memberName: existing.memberName,
        scheduleId: existing.scheduleId,
        ministryId: existing.ministryId,
        ministryName: existing.ministryName,
        eventId: existing.eventId,
        eventName: existing.eventName,
        positionId: existing.positionId,
        positionName: existing.positionName,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      });
    }

    return { hasConflict: conflicts.length > 0, conflicts };
  }

  /** Sobreposição estrita: novo.inicio < existente.fim E novo.fim > existente.inicio. */
  private static overlaps(
    period: { startsAt: Date; endsAt: Date },
    other: { startsAt: Date; endsAt: Date },
  ): boolean {
    return period.startsAt < other.endsAt && period.endsAt > other.startsAt;
  }
}
