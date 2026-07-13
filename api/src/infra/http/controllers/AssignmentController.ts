import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Assignment } from '../../../domain/entities/Assignment';
import {
  AddAssignmentsUseCase,
  AssignmentItem,
} from '../../../domain/use-cases/assignments/AddAssignmentsUseCase';
import { UpdateAssignmentUseCase } from '../../../domain/use-cases/assignments/UpdateAssignmentUseCase';
import { RemoveAssignmentUseCase } from '../../../domain/use-cases/assignments/RemoveAssignmentUseCase';
import { MinistryAccessPolicy } from '../../../domain/services/MinistryAccessPolicy';
import { AssignmentEligibility } from '../../../domain/services/AssignmentEligibility';
import { PrismaAssignmentRepository } from '../../database/repositories/PrismaAssignmentRepository';
import { PrismaScheduleRepository } from '../../database/repositories/PrismaScheduleRepository';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { PrismaMemberRepository } from '../../database/repositories/PrismaMemberRepository';
import { PrismaPositionRepository } from '../../database/repositories/PrismaPositionRepository';
import { PrismaMinistryMembershipRepository } from '../../database/repositories/PrismaMinistryMembershipRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Alocações (Assignment) — pessoa + função dentro da escala de um ministério.
 * Escrita é escopo de ministério: o rbac da rota é só o filtro grosso (bloqueia
 * MEMBRO); a checagem fina (é admin DESTE ministério?) já acontece DENTRO dos
 * use cases via MinistryAccessPolicy.ensureCanManage — o controller não
 * reimplementa essa guarda. institutionId sempre do JWT (req.user).
 */
export class AssignmentController {
  // POST /escalas/:id/alocacoes — adiciona um lote (array) de { memberId, positionId }.
  add = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = AssignmentController.authUser(req);
    const items = AssignmentController.parseItems(req.body);

    const useCase = new AddAssignmentsUseCase(
      new PrismaAssignmentRepository(),
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      AssignmentController.eligibility(),
      AssignmentController.accessPolicy(),
    );
    const result = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      scheduleId: req.params.id,
      items,
    });

    // Sempre 201 quando o use case não lança (pré-condições ok): o resultado
    // por item é dado, não erro HTTP — preserva os motivos de failed no corpo
    // mesmo quando nenhum item foi criado (um status >= 400 zeraria data).
    respond(
      res,
      201,
      {
        created: result.created.map(AssignmentController.serialize),
        failed: result.failed,
      },
      AssignmentController.batchMessage(result.created.length, result.failed.length),
    );
  };

  // PATCH /alocacoes/:id — edição unitária: troca memberId e/ou positionId.
  update = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = AssignmentController.authUser(req);
    const { memberId: newMemberId, positionId: newPositionId } = req.body;

    const useCase = new UpdateAssignmentUseCase(
      new PrismaAssignmentRepository(),
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      AssignmentController.eligibility(),
      AssignmentController.accessPolicy(),
    );
    const assignment = await useCase.execute({
      institutionId,
      actor: { memberId, role },
      id: req.params.id,
      memberId: newMemberId,
      positionId: newPositionId,
    });

    respond(res, 200, AssignmentController.serialize(assignment), 'Alocação atualizada');
  };

  // DELETE /alocacoes/:id — remove a alocação.
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId, memberId, role } = AssignmentController.authUser(req);

    const useCase = new RemoveAssignmentUseCase(
      new PrismaAssignmentRepository(),
      new PrismaScheduleRepository(),
      new PrismaMinistryRepository(),
      AssignmentController.accessPolicy(),
    );
    await useCase.execute({ institutionId, actor: { memberId, role }, id: req.params.id });

    respond(res, 200, null, 'Alocação removida');
  };

  /** Guarda de escopo de ministério (ADMIN_GERAL ou admin com isAdmin no ministério). */
  private static accessPolicy(): MinistryAccessPolicy {
    return new MinistryAccessPolicy(new PrismaMinistryMembershipRepository());
  }

  /** Checagem de pertencimento membro/função ao ministério (compartilhada Add/Update). */
  private static eligibility(): AssignmentEligibility {
    return new AssignmentEligibility(
      new PrismaMemberRepository(),
      new PrismaPositionRepository(),
      new PrismaMinistryMembershipRepository(),
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

  /**
   * Valida a forma do corpo do POST (fronteira HTTP, não regra de negócio):
   * precisa ser um array não-vazio de { memberId, positionId } com strings
   * não-vazias. Barra aqui evita que um item malformado escape para dentro do
   * use case e seja rotulado incorretamente como duplicata (o try/catch do
   * AddAssignmentsUseCase é só o backstop de corrida do @@unique).
   */
  private static parseItems(body: unknown): AssignmentItem[] {
    if (!Array.isArray(body) || body.length === 0) {
      throw new AppError('O corpo deve ser uma lista com ao menos uma alocação', 400);
    }
    return body.map((item, index) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as { memberId?: unknown }).memberId !== 'string' ||
        !(item as { memberId: string }).memberId.trim() ||
        typeof (item as { positionId?: unknown }).positionId !== 'string' ||
        !(item as { positionId: string }).positionId.trim()
      ) {
        throw new AppError(`Item ${index}: informe memberId e positionId (strings)`, 400);
      }
      return {
        memberId: (item as { memberId: string }).memberId,
        positionId: (item as { positionId: string }).positionId,
      };
    });
  }

  /** Mensagem do lote: distingue tudo/parcial/nada criado para o usuário. */
  private static batchMessage(createdCount: number, failedCount: number): string {
    if (failedCount === 0) return 'Todas as alocações foram criadas';
    if (createdCount === 0) return 'Nenhuma alocação pôde ser criada';
    return `${createdCount} alocação(ões) criada(s), ${failedCount} falharam`;
  }

  /** Projeção para a resposta da API. */
  private static serialize(assignment: Assignment) {
    return {
      id: assignment.id,
      scheduleId: assignment.scheduleId,
      memberId: assignment.memberId,
      positionId: assignment.positionId,
      conflict: assignment.conflict,
      createdAt: assignment.createdAt,
    };
  }
}
