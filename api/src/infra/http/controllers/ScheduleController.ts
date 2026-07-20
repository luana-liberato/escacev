import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Schedule } from '../../../domain/entities/Schedule';
import { CreateScheduleUseCase } from '../../../domain/use-cases/schedules/CreateScheduleUseCase';
import { GetScheduleUseCase, ScheduleWithAssignments } from '../../../domain/use-cases/schedules/GetScheduleUseCase';
import {
  GetScheduleConflictsUseCase,
  ScheduleConflictsResult,
} from '../../../domain/use-cases/schedules/GetScheduleConflictsUseCase';
import { ListSchedulesUseCase } from '../../../domain/use-cases/schedules/ListSchedulesUseCase';
import { PublishScheduleUseCase } from '../../../domain/use-cases/schedules/PublishScheduleUseCase';
import { DeleteScheduleUseCase } from '../../../domain/use-cases/schedules/DeleteScheduleUseCase';
import { MinistryAccessPolicy } from '../../../domain/services/MinistryAccessPolicy';
import { ScheduleVisibilityPolicy } from '../../../domain/services/ScheduleVisibilityPolicy';
import { PublishNotification } from '../../../domain/services/PublishNotification';
import { ConflictDetectionService } from '../../../domain/services/ConflictDetectionService';
import { CheckPositionCompatibilityUseCase } from '../../../domain/use-cases/position-compatibilities/CheckPositionCompatibilityUseCase';
import { PrismaScheduleRepository } from '../../database/repositories/PrismaScheduleRepository';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { PrismaEventRepository } from '../../database/repositories/PrismaEventRepository';
import { PrismaAssignmentRepository } from '../../database/repositories/PrismaAssignmentRepository';
import { PrismaPositionCompatibilityRepository } from '../../database/repositories/PrismaPositionCompatibilityRepository';
import { PrismaMinistryMembershipRepository } from '../../database/repositories/PrismaMinistryMembershipRepository';
import { buildNotifier } from '../../services/notifierFactory';
import { DetachedBackgroundTasks } from '../../services/DetachedBackgroundTasks';
import { respond } from '../../../shared/utils/respond';

/**
 * Escalas (Schedule) — a "casca" da escala de um ministério para um evento.
 * Escrita é escopo de ministério (rbac + MinistryAccessPolicy no use case);
 * leitura é escopada por participação (ScheduleVisibilityPolicy): ADMIN_GERAL vê
 * tudo, o ADMIN_MINISTERIO vê os ministérios que participa (rascunho onde é admin,
 * publicadas onde é só membro). institutionId sempre do JWT (req.user).
 */
export class ScheduleController {
  // POST /escalas — cria a escala vazia (RASCUNHO). body: { ministryId, eventId, name?, date? }.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);
    const { ministryId, eventId, name, date } = req.body;

    const useCase = new CreateScheduleUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      new PrismaEventRepository(),
      ScheduleController.accessPolicy(),
    );
    const schedule = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      ministryId,
      eventId,
      name,
      date: ScheduleController.parseDay(date),
    });

    respond(res, 201, ScheduleController.serialize(schedule), 'Escala criada');
  };

  // GET /escalas — lista com filtros opcionais ?eventId= e ?ministryId=.
  // O ator escopa a visão do MEMBRO (só publicadas de ministério que participa).
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);

    const useCase = new ListSchedulesUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      new PrismaEventRepository(),
      ScheduleController.visibilityPolicy(),
    );
    const schedules = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      eventId: ScheduleController.optionalQuery(req, 'eventId'),
      ministryId: ScheduleController.optionalQuery(req, 'ministryId'),
    });

    respond(res, 200, schedules.map(ScheduleController.serialize), 'Escalas listadas');
  };

  // GET /escalas/:id — busca uma escala da própria instituição, com suas alocações.
  // O MEMBRO só alcança escala publicada de ministério que participa (senão 404).
  show = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);

    const useCase = new GetScheduleUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      new PrismaAssignmentRepository(),
      ScheduleController.visibilityPolicy(),
    );
    const result = await useCase.execute({ id: req.params.id, institutionId, actor: { memberId, role } });

    respond(res, 200, ScheduleController.serializeWithAssignments(result), 'Escala encontrada');
  };

  // GET /escalas/:id/conflitos — reavalia AO VIVO os conflitos das alocações da
  // escala (RN01), sem gravar. Leitura aberta a qualquer admin (rbac barra MEMBRO).
  conflicts = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);

    const useCase = new GetScheduleConflictsUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      new PrismaEventRepository(),
      new PrismaAssignmentRepository(),
      ScheduleController.conflictDetection(),
      ScheduleController.visibilityPolicy(),
    );
    const result = await useCase.execute({ id: req.params.id, institutionId, actor: { memberId, role } });

    respond(res, 200, ScheduleController.serializeConflicts(result), 'Conflitos da escala');
  };

  // PATCH /escalas/:id/publicar — publica a escala (RASCUNHO -> PUBLICADA, RN04).
  // Escopo de ministério: rbac barra MEMBRO, a guarda fina é no use case.
  publish = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);

    const useCase = new PublishScheduleUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      ScheduleController.accessPolicy(),
      new PublishNotification(
        new PrismaAssignmentRepository(),
        new PrismaEventRepository(),
        buildNotifier(),
      ),
      new DetachedBackgroundTasks(),
    );
    const schedule = await useCase.execute({ id: req.params.id, institutionId, actor: { memberId, role } });

    respond(res, 200, ScheduleController.serialize(schedule), 'Escala publicada');
  };

  // DELETE /escalas/:id — remove a escala (escopo de ministério).
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);

    const useCase = new DeleteScheduleUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      ScheduleController.accessPolicy(),
    );
    await useCase.execute({ id: req.params.id, institutionId, actor: { memberId, role } });

    respond(res, 200, null, 'Escala removida');
  };

  /** Guarda de escopo de ministério (ADMIN_GERAL ou admin com isAdmin no ministério). */
  private static accessPolicy(): MinistryAccessPolicy {
    return new MinistryAccessPolicy(new PrismaMinistryMembershipRepository());
  }

  /** Guarda de LEITURA: quais escalas o ator enxerga, por participação (RN04). */
  private static visibilityPolicy(): ScheduleVisibilityPolicy {
    return new ScheduleVisibilityPolicy(new PrismaMinistryMembershipRepository());
  }

  /** Motor de detecção de conflito (RN01) — reusa o Check de compatibilidade já existente. */
  private static conflictDetection(): ConflictDetectionService {
    return new ConflictDetectionService(
      new PrismaAssignmentRepository(),
      new CheckPositionCompatibilityUseCase(new PrismaPositionCompatibilityRepository()),
    );
  }

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito e devolve 401 caso a rota seja montada sem o auth antes.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** Lê um parâmetro de query opcional como string; ausente → undefined; array → 400. */
  private static optionalQuery(req: Request, name: string): string | undefined {
    const value = req.query[name];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(`Parâmetro "${name}" inválido`, 400);
    }
    return value;
  }

  /**
   * Converte o `date` do body (dia "YYYY-MM-DD") em Date (meia-noite UTC), ou null
   * quando ausente. É uma DATA pura (sem hora); string vazia/inválida → 400.
   */
  private static parseDay(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new AppError('Dia inválido', 400);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new AppError('Dia inválido', 400);
    return date;
  }

  /** Projeção para a resposta da API. `date` viaja como "YYYY-MM-DD" (sem hora). */
  private static serialize(schedule: Schedule) {
    return {
      id: schedule.id,
      ministryId: schedule.ministryId,
      eventId: schedule.eventId,
      name: schedule.name,
      date: schedule.date ? schedule.date.toISOString().slice(0, 10) : null,
      status: schedule.status,
      publishedAt: schedule.publishedAt,
      createdAt: schedule.createdAt,
    };
  }

  /** Projeção do detalhe (GET /:id): a escala + suas alocações com nomes resolvidos. */
  private static serializeWithAssignments(result: ScheduleWithAssignments) {
    return {
      ...ScheduleController.serialize(result.schedule),
      assignments: result.assignments.map((detail) => ({
        id: detail.assignment.id,
        positionId: detail.assignment.positionId,
        conflict: detail.assignment.conflict,
        createdAt: detail.assignment.createdAt,
        member: { id: detail.member.id, name: detail.member.name },
        position: { id: detail.position.id, name: detail.position.name },
      })),
    };
  }

  /**
   * Projeção da consulta de conflitos (GET /:id/conflitos): a escala + apenas as
   * alocações em conflito, cada uma com os detalhes (já com nomes legíveis, 3a).
   */
  private static serializeConflicts(result: ScheduleConflictsResult) {
    return {
      ...ScheduleController.serialize(result.schedule),
      conflicts: result.conflicts.map((entry) => ({
        assignment: {
          id: entry.assignment.id,
          positionId: entry.assignment.positionId,
          conflict: entry.assignment.conflict,
          createdAt: entry.assignment.createdAt,
          member: { id: entry.member.id, name: entry.member.name },
          position: { id: entry.position.id, name: entry.position.name },
        },
        conflicts: entry.conflicts,
      })),
    };
  }
}
