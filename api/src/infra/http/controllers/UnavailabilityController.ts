import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Unavailability } from '../../../domain/entities/Unavailability';
import { CreateUnavailabilityUseCase } from '../../../domain/use-cases/unavailabilities/CreateUnavailabilityUseCase';
import { ListMyUnavailabilitiesUseCase } from '../../../domain/use-cases/unavailabilities/ListMyUnavailabilitiesUseCase';
import { DeleteUnavailabilityUseCase } from '../../../domain/use-cases/unavailabilities/DeleteUnavailabilityUseCase';
import { PrismaUnavailabilityRepository } from '../../database/repositories/PrismaUnavailabilityRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Indisponibilidade (Unavailability) — período em que o membro não pode ser
 * escalado (RN05). É member-scoped: o memberId vem SEMPRE do JWT (req.user), e
 * cada membro registra/lista/remove apenas as PRÓPRIAS indisponibilidades — por
 * isso as rotas usam só `auth`, sem `rbac` (qualquer perfil, inclusive MEMBRO).
 */
export class UnavailabilityController {
  // POST /indisponibilidades — o membro registra uma indisponibilidade sua.
  create = async (req: Request, res: Response): Promise<void> => {
    const { memberId } = UnavailabilityController.authUser(req);
    const { startsAt, endsAt, reason } = req.body;

    const useCase = new CreateUnavailabilityUseCase(new PrismaUnavailabilityRepository());
    const unavailability = await useCase.execute({
      memberId,
      startsAt: UnavailabilityController.parseDate(startsAt, 'Data de início'),
      endsAt: UnavailabilityController.parseDate(endsAt, 'Data de término'),
      reason,
    });

    respond(res, 201, UnavailabilityController.serialize(unavailability), 'Indisponibilidade registrada');
  };

  // GET /indisponibilidades/minhas — lista as indisponibilidades do próprio membro.
  listMine = async (req: Request, res: Response): Promise<void> => {
    const { memberId } = UnavailabilityController.authUser(req);

    const useCase = new ListMyUnavailabilitiesUseCase(new PrismaUnavailabilityRepository());
    const items = await useCase.execute({ memberId });

    respond(res, 200, items.map(UnavailabilityController.serialize), 'Indisponibilidades listadas');
  };

  // DELETE /indisponibilidades/:id — remove uma indisponibilidade do próprio membro.
  remove = async (req: Request, res: Response): Promise<void> => {
    const { memberId } = UnavailabilityController.authUser(req);

    const useCase = new DeleteUnavailabilityUseCase(new PrismaUnavailabilityRepository());
    await useCase.execute({ id: req.params.id, memberId });

    respond(res, 200, null, 'Indisponibilidade removida');
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

  /** Projeção para a resposta da API. */
  private static serialize(unavailability: Unavailability) {
    return {
      id: unavailability.id,
      memberId: unavailability.memberId,
      startsAt: unavailability.startsAt,
      endsAt: unavailability.endsAt,
      reason: unavailability.reason,
      createdAt: unavailability.createdAt,
    };
  }
}
