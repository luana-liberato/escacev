import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import { Member } from '../../../domain/entities/Member';
import { CreateMemberUseCase } from '../../../domain/use-cases/members/CreateMemberUseCase';
import { ListMembersUseCase } from '../../../domain/use-cases/members/ListMembersUseCase';
import { GetMemberUseCase } from '../../../domain/use-cases/members/GetMemberUseCase';
import { UpdateMemberUseCase } from '../../../domain/use-cases/members/UpdateMemberUseCase';
import { DeactivateMemberUseCase } from '../../../domain/use-cases/members/DeactivateMemberUseCase';
import { PrismaMemberRepository } from '../../database/repositories/PrismaMemberRepository';
import { buildNotifier } from '../../services/notifierFactory';
import { respond } from '../../../shared/utils/respond';

export class MemberController {
  // POST /membros — cria (convida) um membro. institutionId vem do JWT.
  create = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MemberController.authUser(req);
    const { name, email, role } = req.body;

    const useCase = new CreateMemberUseCase(new PrismaMemberRepository(), buildNotifier());
    const member = await useCase.execute({ institutionId, name, email, role });

    respond(res, 201, MemberController.serialize(member), 'Membro criado');
  };

  // GET /membros — lista os membros da instituição do usuário autenticado.
  list = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MemberController.authUser(req);

    const useCase = new ListMembersUseCase(new PrismaMemberRepository());
    const members = await useCase.execute({ institutionId });

    respond(res, 200, members.map(MemberController.serialize), 'Membros listados');
  };

  /**
   * GET /membros/me — o usuário autenticado busca os PRÓPRIOS dados.
   *
   * Member-scoped: sem `rbac`, porque todo perfil precisa se enxergar — o
   * `GET /membros/:id` exige admin, então um MEMBRO não conseguia ler o próprio
   * cadastro. O JWT carrega só `{ memberId, institutionId, role }`; nome e e-mail
   * saem daqui.
   *
   * Não há parâmetro: o id vem do JWT, então ninguém lê o cadastro alheio por
   * esta rota. Reusa o GetMemberUseCase — a checagem de tenant dele é redundante
   * aqui (o membro é do próprio tenant por definição), mas o custo é zero e
   * duplicar a busca não se justifica.
   */
  showMe = async (req: Request, res: Response): Promise<void> => {
    const { memberId, institutionId } = MemberController.authUser(req);

    const useCase = new GetMemberUseCase(new PrismaMemberRepository());
    const member = await useCase.execute({ id: memberId, institutionId });

    respond(res, 200, MemberController.serialize(member), 'Membro encontrado');
  };

  // GET /membros/:id — busca um membro da própria instituição.
  show = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MemberController.authUser(req);

    const useCase = new GetMemberUseCase(new PrismaMemberRepository());
    const member = await useCase.execute({ id: req.params.id, institutionId });

    respond(res, 200, MemberController.serialize(member), 'Membro encontrado');
  };

  // PUT /membros/:id — atualiza nome, perfil e/ou status ativo.
  update = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MemberController.authUser(req);
    const { name, role, active } = req.body;

    const useCase = new UpdateMemberUseCase(new PrismaMemberRepository());
    const member = await useCase.execute({
      id: req.params.id,
      institutionId,
      name,
      role,
      active,
    });

    respond(res, 200, MemberController.serialize(member), 'Membro atualizado');
  };

  // DELETE /membros/:id — desativa o membro (soft delete via campo ativo).
  remove = async (req: Request, res: Response): Promise<void> => {
    const { institutionId } = MemberController.authUser(req);

    const useCase = new DeactivateMemberUseCase(new PrismaMemberRepository());
    const member = await useCase.execute({ id: req.params.id, institutionId });

    respond(res, 200, MemberController.serialize(member), 'Membro desativado');
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

  /**
   * Projeção segura para a resposta da API: expõe apenas campos públicos.
   * Omite o accountId (FK interna de autenticação) e sinaliza convite pendente.
   */
  private static serialize(member: Member) {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      active: member.active,
      pending: member.isPending,
      createdAt: member.createdAt,
    };
  }
}
