import { PerfilUsuario } from '@prisma/client';
import { MinistryMembership } from '../../entities/MinistryMembership';
import { MemberRepository } from '../../repositories/MemberRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface SetMembershipAdminDTO {
  institutionId: string;
  actor: Actor;
  ministryId: string;
  memberId: string;
  isAdmin: boolean;
}

/**
 * Promove (isAdmin = true) ou rebaixa (isAdmin = false) o papel de admin de um
 * vínculo existente. Valida que o ministério pertence à instituição do usuário,
 * que o ator administra o ministério (Permissão Escopada) e que o vínculo existe
 * (404). Dependências injetadas via construtor (Seção 4.2).
 *
 * DERIVA O PERFIL depois de mexer no vínculo — igual ao SetMemberMinistriesUseCase.
 * Sem isso, promover por aqui daria `isAdmin = true` a alguém que continuaria
 * `MEMBRO` no perfil: o `rbac` da rota o barraria ANTES da MinistryAccessPolicy
 * rodar, e ele seria um admin sem poder. A regra tem que valer para TODA porta que
 * mexe em `isAdmin`, senão depende de por onde se entra.
 */
export class SetMembershipAdminUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
    private readonly memberRepo: MemberRepository,
  ) {}

  async execute(dto: SetMembershipAdminDTO): Promise<MinistryMembership> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    const membership = await this.membershipRepo.findByMemberAndMinistry(
      dto.memberId,
      ministry.id,
    );
    if (!membership) {
      throw new AppError('Este membro não está neste ministério', 404);
    }

    const updated = await this.membershipRepo.update(membership.setAdmin(dto.isAdmin));
    await this.deriveRole(dto.memberId);
    return updated;
  }

  /**
   * Administra pelo menos um ministério → ADMIN_MINISTERIO; nenhum → MEMBRO.
   * Lê os vínculos DEPOIS da escrita, para contar o estado real.
   *
   * O ADMIN_GERAL é exceção: o poder dele é da INSTITUIÇÃO e não vem de vínculo —
   * rebaixá-lo por deixar de administrar um ministério tiraria o poder de quem
   * administra todos.
   */
  private async deriveRole(memberId: string): Promise<void> {
    const member = await this.memberRepo.findById(memberId);
    if (!member || member.role === 'ADMIN_GERAL') return;

    const views = await this.membershipRepo.findMinistriesByMember(memberId);
    const derived: PerfilUsuario = views.some((view) => view.membership.isAdmin)
      ? 'ADMIN_MINISTERIO'
      : 'MEMBRO';
    if (derived === member.role) return;

    await this.memberRepo.update(member.update({ role: derived }));
  }
}
