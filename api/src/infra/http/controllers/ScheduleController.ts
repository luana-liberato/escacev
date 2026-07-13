import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Schedule } from '../../../domain/entities/Schedule';
import { CreateScheduleUseCase } from '../../../domain/use-cases/schedules/CreateScheduleUseCase';
import { GetScheduleUseCase } from '../../../domain/use-cases/schedules/GetScheduleUseCase';
import { ListSchedulesUseCase } from '../../../domain/use-cases/schedules/ListSchedulesUseCase';
import { DeleteScheduleUseCase } from '../../../domain/use-cases/schedules/DeleteScheduleUseCase';
import { MinistryAccessPolicy } from '../../../domain/services/MinistryAccessPolicy';
import { PrismaScheduleRepository } from '../../database/repositories/PrismaScheduleRepository';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { PrismaEventRepository } from '../../database/repositories/PrismaEventRepository';
import { PrismaMinistryMembershipRepository } from '../../database/repositories/PrismaMinistryMembershipRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Escalas (Schedule) — a "casca" da escala de um ministério para um evento.
 * Escrita é escopo de ministério (rbac + MinistryAccessPolicy no use case);
 * leitura é aberta a qualquer admin. institutionId sempre do JWT (req.user).
 */
export class ScheduleController {
  // POST /escalas — cria a escala vazia (RASCUNHO). body: { ministryId, eventId, name? }.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = ScheduleController.authUser(req);
    const { ministryId, eventId, name } = req.body;

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
    });

    respond(res, 201, ScheduleController.serialize(schedule), 'Escala criada');
  };

  // GET /escalas — lista com filtros opcionais ?eventId= e ?ministryId=.
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = ScheduleController.authUser(req);

    const useCase = new ListSchedulesUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      new PrismaEventRepository(),
    );
    const schedules = await useCase.execute({
      institutionId,
      eventId: ScheduleController.optionalQuery(req, 'eventId'),
      ministryId: ScheduleController.optionalQuery(req, 'ministryId'),
    });

    respond(res, 200, schedules.map(ScheduleController.serialize), 'Escalas listadas');
  };

  // GET /escalas/:id — busca uma escala da própria instituição.
  show = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = ScheduleController.authUser(req);

    const useCase = new GetScheduleUseCase(
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
    );
    const schedule = await useCase.execute({ id: req.params.id, institutionId });

    respond(res, 200, ScheduleController.serialize(schedule), 'Escala encontrada');
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

  /** Projeção para a resposta da API. */
  private static serialize(schedule: Schedule) {
    return {
      id: schedule.id,
      ministryId: schedule.ministryId,
      eventId: schedule.eventId,
      name: schedule.name,
      status: schedule.status,
      publishedAt: schedule.publishedAt,
      createdAt: schedule.createdAt,
    };
  }
}
