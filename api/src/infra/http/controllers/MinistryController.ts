import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Ministry } from '../../../domain/entities/Ministry';
import { CreateMinistryUseCase } from '../../../domain/use-cases/CreateMinistryUseCase';
import { ListMinistriesUseCase } from '../../../domain/use-cases/ListMinistriesUseCase';
import { GetMinistryUseCase } from '../../../domain/use-cases/GetMinistryUseCase';
import { UpdateMinistryUseCase } from '../../../domain/use-cases/UpdateMinistryUseCase';
import { DeleteMinistryUseCase } from '../../../domain/use-cases/DeleteMinistryUseCase';
import { MinistryAccessPolicy } from '../../../domain/services/MinistryAccessPolicy';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { PrismaMinistryMembershipRepository } from '../../database/repositories/PrismaMinistryMembershipRepository';
import { respond } from '../../../shared/utils/respond';

export class MinistryController {
  // POST /ministerios — cria um ministério. institutionId vem do JWT.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryController.authUser(req);
    const { name, description } = req.body;

    const useCase = new CreateMinistryUseCase(new PrismaMinistryRepository());
    const ministry = await useCase.execute({ institutionId, name, description });

    respond(res, 201, MinistryController.serialize(ministry), 'Ministério criado');
  };

  // GET /ministerios — lista os ministérios da instituição do usuário autenticado.
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryController.authUser(req);

    const useCase = new ListMinistriesUseCase(new PrismaMinistryRepository());
    const ministries = await useCase.execute({ institutionId });

    respond(res, 200, ministries.map(MinistryController.serialize), 'Ministérios listados');
  };

  // GET /ministerios/:id — busca um ministério da própria instituição.
  show = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryController.authUser(req);

    const useCase = new GetMinistryUseCase(new PrismaMinistryRepository());
    const ministry = await useCase.execute({ id: req.params.id, institutionId });

    respond(res, 200, MinistryController.serialize(ministry), 'Ministério encontrado');
  };

  // PUT /ministerios/:id — atualiza nome e/ou descrição.
  update = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = MinistryController.authUser(req);
    const { name, description } = req.body;

    const useCase = new UpdateMinistryUseCase(
      new PrismaMinistryRepository(),
      new MinistryAccessPolicy(new PrismaMinistryMembershipRepository()),
    );
    const ministry = await useCase.execute({
      id: req.params.id,
      institutionId,
      actor: { memberId, role },
      name,
      description,
    });

    respond(res, 200, MinistryController.serialize(ministry), 'Ministério atualizado');
  };

  // DELETE /ministerios/:id — remove o ministério (bloqueado se houver dependências).
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryController.authUser(req);

    const useCase = new DeleteMinistryUseCase(new PrismaMinistryRepository());
    await useCase.execute({ id: req.params.id, institutionId });

    respond(res, 200, null, 'Ministério removido');
  };

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito (sem non-null assertion) e devolve 401 caso a rota seja
   * montada sem o middleware auth antes do controller.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** Projeção para a resposta da API (o institutionId fica implícito no tenant). */
  private static serialize(ministry: Ministry) {
    return {
      id: ministry.id,
      name: ministry.name,
      description: ministry.description,
      createdAt: ministry.createdAt,
    };
  }
}
