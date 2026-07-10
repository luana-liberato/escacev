import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Position } from '../../../domain/entities/Position';
import { CreatePositionUseCase } from '../../../domain/use-cases/CreatePositionUseCase';
import { ListPositionsUseCase } from '../../../domain/use-cases/ListPositionsUseCase';
import { UpdatePositionUseCase } from '../../../domain/use-cases/UpdatePositionUseCase';
import { DeletePositionUseCase } from '../../../domain/use-cases/DeletePositionUseCase';
import { MinistryAccessPolicy } from '../../../domain/services/MinistryAccessPolicy';
import { PrismaPositionRepository } from '../../database/repositories/PrismaPositionRepository';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { PrismaMinistryMembershipRepository } from '../../database/repositories/PrismaMinistryMembershipRepository';
import { respond } from '../../../shared/utils/respond';

export class PositionController {
  // POST /ministerios/:id/funcoes — cria função no ministério :id. institutionId do JWT.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = PositionController.authUser(req);
    const { name } = req.body;

    const useCase = new CreatePositionUseCase(
      new PrismaPositionRepository(),
      new PrismaMinistryRepository(),
      PositionController.accessPolicy(),
    );
    const position = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      ministryId: req.params.id,
      name,
    });

    respond(res, 201, PositionController.serialize(position), 'Função criada');
  };

  // GET /ministerios/:id/funcoes — lista as funções do ministério :id.
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = PositionController.authUser(req);

    const useCase = new ListPositionsUseCase(
      new PrismaPositionRepository(),
      new PrismaMinistryRepository(),
    );
    const positions = await useCase.execute({ institutionId, ministryId: req.params.id });

    respond(res, 200, positions.map(PositionController.serialize), 'Funções listadas');
  };

  // PUT /funcoes/:id — edita o nome da função (ministério resolvido pelo id).
  update = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = PositionController.authUser(req);
    const { name } = req.body;

    const useCase = new UpdatePositionUseCase(
      new PrismaPositionRepository(),
      new PrismaMinistryRepository(),
      PositionController.accessPolicy(),
    );
    const position = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      id: req.params.id,
      name,
    });

    respond(res, 200, PositionController.serialize(position), 'Função atualizada');
  };

  // DELETE /funcoes/:id — remove a função (409 se em uso em escalas/alocações).
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = PositionController.authUser(req);

    const useCase = new DeletePositionUseCase(
      new PrismaPositionRepository(),
      new PrismaMinistryRepository(),
      PositionController.accessPolicy(),
    );
    await useCase.execute({ institutionId, actor: { memberId, role }, id: req.params.id });

    respond(res, 200, null, 'Função removida');
  };

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito e devolve 401 caso a rota seja montada sem o auth antes.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** Guarda de escopo de ministério (ADMIN_GERAL ou admin com isAdmin no ministério). */
  private static accessPolicy(): MinistryAccessPolicy {
    return new MinistryAccessPolicy(new PrismaMinistryMembershipRepository());
  }

  /** Projeção para a resposta da API. */
  private static serialize(position: Position) {
    return {
      id: position.id,
      name: position.name,
      ministryId: position.ministryId,
      createdAt: position.createdAt,
    };
  }
}
