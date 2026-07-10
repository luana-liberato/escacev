import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Event } from '../../../domain/entities/Event';
import { CreateEventUseCase } from '../../../domain/use-cases/CreateEventUseCase';
import { ListEventsUseCase } from '../../../domain/use-cases/ListEventsUseCase';
import { GetEventUseCase } from '../../../domain/use-cases/GetEventUseCase';
import { UpdateEventUseCase } from '../../../domain/use-cases/UpdateEventUseCase';
import { DeleteEventUseCase } from '../../../domain/use-cases/DeleteEventUseCase';
import { PrismaEventRepository } from '../../database/repositories/PrismaEventRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Eventos (Event) — calendário da instituição. Evento é escopo de INSTITUIÇÃO,
 * não de ministério (sem MinistryAccessPolicy aqui — o RBAC de rota resolve).
 * institutionId sempre do JWT (req.user).
 */
export class EventController {
  // POST /eventos — cria evento no calendário da instituição.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = EventController.authUser(req);
    const { name, type, startsAt, endsAt } = req.body;

    const useCase = new CreateEventUseCase(new PrismaEventRepository());
    const event = await useCase.execute({
      institutionId,
      name,
      type,
      startsAt: EventController.parseDate(startsAt, 'Data de início'),
      endsAt: EventController.parseDate(endsAt, 'Data de término'),
    });

    respond(res, 201, EventController.serialize(event), 'Evento criado');
  };

  // GET /eventos — lista os eventos da instituição; ?from=&to= filtram por período (ISO 8601).
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = EventController.authUser(req);

    const useCase = new ListEventsUseCase(new PrismaEventRepository());
    const events = await useCase.execute({
      institutionId,
      from: EventController.parseOptionalDate(req.query.from, 'from'),
      to: EventController.parseOptionalDate(req.query.to, 'to'),
    });

    respond(res, 200, events.map(EventController.serialize), 'Eventos listados');
  };

  // GET /eventos/:id — busca um evento da instituição.
  get = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = EventController.authUser(req);

    const useCase = new GetEventUseCase(new PrismaEventRepository());
    const event = await useCase.execute({ institutionId, id: req.params.id });

    respond(res, 200, EventController.serialize(event), 'Evento encontrado');
  };

  // PUT /eventos/:id — edita nome, tipo e horários (campos ausentes não mudam).
  update = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = EventController.authUser(req);
    const { name, type, startsAt, endsAt } = req.body;

    const useCase = new UpdateEventUseCase(new PrismaEventRepository());
    const event = await useCase.execute({
      institutionId,
      id: req.params.id,
      name,
      type,
      startsAt: startsAt !== undefined ? EventController.parseDate(startsAt, 'Data de início') : undefined,
      endsAt: endsAt !== undefined ? EventController.parseDate(endsAt, 'Data de término') : undefined,
    });

    respond(res, 200, EventController.serialize(event), 'Evento atualizado');
  };

  // DELETE /eventos/:id — remove o evento (409 se houver escalas vinculadas).
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = EventController.authUser(req);

    const useCase = new DeleteEventUseCase(new PrismaEventRepository());
    await useCase.execute({ institutionId, id: req.params.id });

    respond(res, 200, null, 'Evento removido');
  };

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito e devolve 401 caso a rota seja montada sem o auth antes.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** Converte uma data ISO obrigatória do body; 400 se ausente/inválida. */
  private static parseDate(value: unknown, label: string): Date {
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(`${label} é obrigatória`, 400);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(`${label} inválida`, 400);
    }
    return date;
  }

  /** Converte uma data ISO opcional da query (?from=/?to=); undefined se ausente. */
  private static parseOptionalDate(value: unknown, param: string): Date | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(`Parâmetro "${param}" inválido`, 400);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(`Parâmetro "${param}" inválido`, 400);
    }
    return date;
  }

  /** Projeção para a resposta da API. */
  private static serialize(event: Event) {
    return {
      id: event.id,
      name: event.name,
      type: event.type,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      institutionId: event.institutionId,
      createdAt: event.createdAt,
    };
  }
}
