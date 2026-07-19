import { Schedule } from '../../entities/Schedule';
import { Assignment } from '../../entities/Assignment';
import { Member } from '../../entities/Member';
import { Position } from '../../entities/Position';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { Actor } from '../../services/MinistryAccessPolicy';
import { ConflictDetail, ConflictDetectionService } from '../../services/ConflictDetectionService';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetScheduleConflictsDTO {
  institutionId: string;
  id: string;
  /** Ator autenticado — usado só para escopar a visão do MEMBRO. */
  actor?: Actor;
}

/**
 * Uma alocação DESTA escala que colide com ao menos uma outra alocação do mesmo
 * membro (RN01) — a própria alocação (membro/função resolvidos) mais os detalhes
 * de cada conflito. Os `conflicts` já vêm com nomes legíveis (incremento 3a).
 */
export interface AssignmentConflicts {
  assignment: Assignment;
  member: Member;
  position: Position;
  conflicts: ConflictDetail[];
}

/** A escala + apenas as suas alocações que estão em conflito. */
export interface ScheduleConflictsResult {
  schedule: Schedule;
  conflicts: AssignmentConflicts[];
}

/**
 * Consulta READ-ONLY dos conflitos de uma escala (RN01) — reavalia, alocação por
 * alocação, se o membro colide com alguma outra alocação sua (em qualquer
 * ministério/escala), sem gravar nada. Diferente da flag `conflict` persistida
 * (que registra a decisão CIENTE do admin no momento da criação, RN03): aqui o
 * motor roda AO VIVO, então acusa também conflitos que surgiram DEPOIS — ex.: o
 * membro foi escalado em outra escala sobreposta, ou a matriz de compatibilidade
 * mudou. É a visão que o admin usa para revisar a escala antes de publicar.
 *
 * Para cada alocação da escala, chama o ConflictDetectionService com o horário do
 * evento da própria escala e `excludeAssignmentId = a própria` (para não conflitar
 * consigo mesma). Só entram no resultado as alocações que têm ao menos um conflito.
 *
 * Para o ADMIN a transparência é total, inclusive sobre conflitos em ministérios
 * que ele não administra (3a). Para o MEMBRO a leitura é escopada (só escala
 * PUBLICADA de ministério que participa — RN04), como no GetScheduleUseCase.
 * Valida o tenant pela instituição do ministério da escala (a Escala não tem
 * instituicaoId próprio); 404 quando não existe ou é de outra instituição.
 * Dependências via construtor (Seção 4.2).
 */
export class GetScheduleConflictsUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly eventRepo: EventRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly conflictDetection: ConflictDetectionService,
    private readonly membershipRepo?: MinistryMembershipRepository,
  ) {}

  async execute(dto: GetScheduleConflictsDTO): Promise<ScheduleConflictsResult> {
    const schedule = await this.scheduleRepo.findById(dto.id);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    // Visão do MEMBRO (RN04): só conflitos de escala PUBLICADA de ministério que
    // participa; senão 404 (não revela rascunho nem ministério alheio).
    if (dto.actor?.role === 'MEMBRO' && this.membershipRepo) {
      const membership = await this.membershipRepo.findByMemberAndMinistry(
        dto.actor.memberId,
        schedule.ministryId,
      );
      if (schedule.status !== 'PUBLICADA' || !membership) {
        throw new AppError('Escala não encontrada', 404);
      }
    }

    // Todas as alocações da escala compartilham o mesmo evento; busca uma vez.
    const event = await this.eventRepo.findById(schedule.eventId);
    if (!event) {
      throw new AppError('Escala não encontrada', 404);
    }

    const details = await this.assignmentRepo.findByScheduleWithDetails(schedule.id);

    const conflicts: AssignmentConflicts[] = [];
    for (const detail of details) {
      const result = await this.conflictDetection.check({
        memberId: detail.assignment.memberId,
        positionId: detail.assignment.positionId,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        excludeAssignmentId: detail.assignment.id,
        candidatePublishedAt: schedule.publishedAt, // RN07: precedência por publicação
      });

      if (result.hasConflict) {
        conflicts.push({
          assignment: detail.assignment,
          member: detail.member,
          position: detail.position,
          conflicts: result.conflicts,
        });
      }
    }

    return { schedule, conflicts };
  }
}
