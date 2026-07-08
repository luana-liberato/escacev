import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Member } from '../../../domain/entities/Member';
import { Ministry } from '../../../domain/entities/Ministry';
import { MinistryMembership } from '../../../domain/entities/MinistryMembership';
import {
  MemberMinistryView,
  MinistryMemberView,
} from '../../../domain/repositories/MinistryMembershipRepository';
import { AssociateMemberToMinistryUseCase } from '../../../domain/use-cases/AssociateMemberToMinistryUseCase';
import { InviteMemberToMinistryUseCase } from '../../../domain/use-cases/InviteMemberToMinistryUseCase';
import { SetMembershipAdminUseCase } from '../../../domain/use-cases/SetMembershipAdminUseCase';
import { RemoveMemberFromMinistryUseCase } from '../../../domain/use-cases/RemoveMemberFromMinistryUseCase';
import { ListMembershipsUseCase } from '../../../domain/use-cases/ListMembershipsUseCase';
import { CreateMemberUseCase } from '../../../domain/use-cases/CreateMemberUseCase';
import { PrismaMinistryMembershipRepository } from '../../database/repositories/PrismaMinistryMembershipRepository';
import { PrismaMinistryRepository } from '../../database/repositories/PrismaMinistryRepository';
import { PrismaMemberRepository } from '../../database/repositories/PrismaMemberRepository';
import { respond } from '../../../shared/utils/respond';

export class MinistryMembershipController {
  // POST /ministerios/:id/membros — associa um membro existente. institutionId vem do JWT.
  associate = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryMembershipController.authUser(req);
    const { memberId } = req.body;
    const isAdmin = MinistryMembershipController.optionalBoolean(req.body.isAdmin, 'isAdmin');

    const useCase = new AssociateMemberToMinistryUseCase(
      new PrismaMinistryMembershipRepository(),
      new PrismaMinistryRepository(),
      new PrismaMemberRepository(),
    );
    const membership = await useCase.execute({
      institutionId,
      ministryId: req.params.id,
      memberId,
      isAdmin,
    });

    respond(
      res,
      201,
      MinistryMembershipController.serializeMembership(membership),
      'Membro associado ao ministério',
    );
  };

  // POST /ministerios/:id/membros/convite — convida (criar-ou-associar). institutionId vem do JWT.
  invite = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryMembershipController.authUser(req);
    const { name, email } = req.body;
    const isAdmin = MinistryMembershipController.optionalBoolean(req.body.isAdmin, 'isAdmin');

    const memberRepo = new PrismaMemberRepository();
    const useCase = new InviteMemberToMinistryUseCase(
      new PrismaMinistryMembershipRepository(),
      new PrismaMinistryRepository(),
      memberRepo,
      new CreateMemberUseCase(memberRepo),
    );
    const result = await useCase.execute({
      institutionId,
      ministryId: req.params.id,
      name,
      email,
      isAdmin,
    });

    respond(
      res,
      201,
      {
        member: MinistryMembershipController.serializeMember(result.member),
        isAdmin: result.membership.isAdmin,
        since: result.membership.createdAt,
      },
      result.created
        ? 'Membro criado e associado ao ministério'
        : 'Membro associado ao ministério',
    );
  };

  // PATCH /ministerios/:id/membros/:membroId/admin — promove/rebaixa admin do ministério.
  setAdmin = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryMembershipController.authUser(req);
    const isAdmin = MinistryMembershipController.requiredBoolean(req.body.isAdmin, 'isAdmin');

    const useCase = new SetMembershipAdminUseCase(
      new PrismaMinistryMembershipRepository(),
      new PrismaMinistryRepository(),
    );
    const membership = await useCase.execute({
      institutionId,
      ministryId: req.params.id,
      memberId: req.params.membroId,
      isAdmin,
    });

    respond(
      res,
      200,
      MinistryMembershipController.serializeMembership(membership),
      isAdmin ? 'Membro promovido a admin do ministério' : 'Membro rebaixado a participante',
    );
  };

  // DELETE /ministerios/:id/membros/:membroId — remove a associação.
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryMembershipController.authUser(req);

    const useCase = new RemoveMemberFromMinistryUseCase(
      new PrismaMinistryMembershipRepository(),
      new PrismaMinistryRepository(),
    );
    await useCase.execute({
      institutionId,
      ministryId: req.params.id,
      memberId: req.params.membroId,
    });

    respond(res, 200, null, 'Membro removido do ministério');
  };

  // GET /ministerios/:id/membros — lista os membros do ministério (com isAdmin).
  listMembers = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryMembershipController.authUser(req);

    const useCase = MinistryMembershipController.listUseCase();
    const views = await useCase.membersOfMinistry({ institutionId, ministryId: req.params.id });

    respond(
      res,
      200,
      views.map(MinistryMembershipController.serializeMemberView),
      'Membros do ministério listados',
    );
  };

  // GET /membros/:id/ministerios — lista os ministérios do membro (com isAdmin).
  listMinistries = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MinistryMembershipController.authUser(req);

    const useCase = MinistryMembershipController.listUseCase();
    const views = await useCase.ministriesOfMember({ institutionId, memberId: req.params.id });

    respond(
      res,
      200,
      views.map(MinistryMembershipController.serializeMinistryView),
      'Ministérios do membro listados',
    );
  };

  private static listUseCase(): ListMembershipsUseCase {
    return new ListMembershipsUseCase(
      new PrismaMinistryMembershipRepository(),
      new PrismaMinistryRepository(),
      new PrismaMemberRepository(),
    );
  }

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito (sem non-null assertion) e devolve 401 caso a rota seja
   * montada sem o middleware auth antes do controller.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /** isAdmin opcional no body: ausente vira undefined; presente exige booleano. */
  private static optionalBoolean(value: unknown, field: string): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    return MinistryMembershipController.requiredBoolean(value, field);
  }

  /** isAdmin obrigatório no body: exige booleano verdadeiro/falso. */
  private static requiredBoolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
      throw new AppError(`O campo ${field} deve ser um booleano (true ou false)`, 400);
    }
    return value;
  }

  /** Projeção do vínculo cru (associar/promover/rebaixar). */
  private static serializeMembership(membership: MinistryMembership) {
    return {
      memberId: membership.memberId,
      ministryId: membership.ministryId,
      isAdmin: membership.isAdmin,
      createdAt: membership.createdAt,
    };
  }

  /** Membro do ministério + papel de admin do vínculo. */
  private static serializeMemberView(view: MinistryMemberView) {
    return {
      ...MinistryMembershipController.serializeMember(view.member),
      isAdmin: view.membership.isAdmin,
      since: view.membership.createdAt,
    };
  }

  /** Ministério do membro + papel de admin do vínculo. */
  private static serializeMinistryView(view: MemberMinistryView) {
    return {
      ...MinistryMembershipController.serializeMinistry(view.ministry),
      isAdmin: view.membership.isAdmin,
      since: view.membership.createdAt,
    };
  }

  /** Projeção pública do membro (omite accountId, sinaliza convite pendente). */
  private static serializeMember(member: Member) {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      active: member.active,
      pending: member.isPending,
    };
  }

  /** Projeção pública do ministério. */
  private static serializeMinistry(ministry: Ministry) {
    return {
      id: ministry.id,
      name: ministry.name,
      description: ministry.description,
    };
  }
}
