import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { PositionCompatibility } from '../../../domain/entities/PositionCompatibility';
import { SetPositionCompatibilityUseCase } from '../../../domain/use-cases/position-compatibilities/SetPositionCompatibilityUseCase';
import { RemovePositionCompatibilityUseCase } from '../../../domain/use-cases/position-compatibilities/RemovePositionCompatibilityUseCase';
import { ListPositionCompatibilitiesUseCase } from '../../../domain/use-cases/position-compatibilities/ListPositionCompatibilitiesUseCase';
import { PrismaPositionCompatibilityRepository } from '../../database/repositories/PrismaPositionCompatibilityRepository';
import { PrismaPositionRepository } from '../../database/repositories/PrismaPositionRepository';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Matriz de compatibilidade entre funções (RN01/RN02). É configuração de escopo
 * de INSTITUIÇÃO — todas as ações são restritas ao ADMIN_GERAL pelo rbac na rota
 * (não há MinistryAccessPolicy aqui). institutionId sempre do JWT (req.user).
 */
export class PositionCompatibilityController {
  // POST /funcoes/compatibilidade — marca o par (positionAId, positionBId) como compatível.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = PositionCompatibilityController.authUser(req);
    const { positionAId, positionBId } = req.body;

    const useCase = new SetPositionCompatibilityUseCase(
      new PrismaPositionCompatibilityRepository(),
      new PrismaPositionRepository(),
      new PrismaMinistryRepository(),
    );
    const compatibility = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      positionAId,
      positionBId,
    });

    // 201 sempre: o Set é idempotente, então remarcar um par já existente devolve
    // o mesmo par sem duplicar (decisão registrada no critério de aceite).
    respond(
      res,
      201,
      PositionCompatibilityController.serialize(compatibility),
      'Compatibilidade registrada',
    );
  };

  // DELETE /funcoes/compatibilidade?positionAId=..&positionBId=.. — remove o par.
  // Os ids vão na query (não no body): DELETE não tem semântica de corpo confiável;
  // os dois ids identificam qual par apagar (decisão do critério de aceite).
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = PositionCompatibilityController.authUser(req);
    const positionAId = PositionCompatibilityController.requireQuery(req, 'positionAId');
    const positionBId = PositionCompatibilityController.requireQuery(req, 'positionBId');

    const useCase = new RemovePositionCompatibilityUseCase(
      new PrismaPositionCompatibilityRepository(),
      new PrismaPositionRepository(),
      new PrismaMinistryRepository(),
    );
    await useCase.execute({
      institutionId,
      actor: { memberId, role },
      positionAId,
      positionBId,
    });

    respond(res, 200, null, 'Compatibilidade removida');
  };

  // GET /funcoes/compatibilidade — lista os pares compatíveis da instituição.
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = PositionCompatibilityController.authUser(req);

    const useCase = new ListPositionCompatibilitiesUseCase(
      new PrismaPositionCompatibilityRepository(),
    );
    const compatibilities = await useCase.execute({
      institutionId,
      actor: { memberId, role },
    });

    respond(
      res,
      200,
      compatibilities.map(PositionCompatibilityController.serialize),
      'Compatibilidades listadas',
    );
  };

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito e devolve 401 caso a rota seja montada sem o auth antes.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** Lê um parâmetro de query obrigatório como string; 400 se ausente/inválido. */
  private static requireQuery(req: Request, name: string): string {
    const value = req.query[name];
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(`Parâmetro "${name}" é obrigatório`, 400);
    }
    return value;
  }

  /** Projeção para a resposta da API. */
  private static serialize(compatibility: PositionCompatibility) {
    return {
      id: compatibility.id,
      positionAId: compatibility.positionAId,
      positionBId: compatibility.positionBId,
      createdAt: compatibility.createdAt,
    };
  }
}
