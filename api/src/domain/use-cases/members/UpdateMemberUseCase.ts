import { PerfilUsuario } from '@prisma/client';
import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { AppError } from '../../../shared/errors/AppError';

/** Campos atualizáveis. institutionId e id identificam o alvo; não são mutáveis. */
export interface UpdateMemberDTO {
  id: string;
  institutionId: string;
  name?: string;
  role?: PerfilUsuario;
  active?: boolean;
}

/**
 * Atualiza nome, perfil e/ou status ativo de um membro, garantindo que ele
 * pertence à instituição do usuário autenticado (isolamento por tenant).
 * A validação dos novos valores fica na entidade (Member.update).
 *
 * REBAIXAR PARA MEMBRO LIMPA O isAdmin DE TODOS OS VÍNCULOS. Sem isso o estado
 * fica mentiroso: o banco diria que a pessoa administra o Louvor, a tela mostraria
 * "Louvor · admin", e o `rbac` da rota a barraria antes da MinistryAccessPolicy
 * rodar — um admin sem poder, e ninguém entenderia por quê. A regra mora aqui, e
 * não na tela, para valer em qualquer caminho que rebaixe alguém.
 *
 * Promover NÃO tem o inverso: "administrador de grupo" não diz de QUAL grupo, e o
 * sistema não tem como adivinhar. Quem define é o SetMemberMinistriesUseCase, ao
 * marcar os ministérios — e é de lá que o perfil ADMIN_MINISTERIO é derivado.
 */
export class UpdateMemberUseCase {
  constructor(
    private readonly memberRepo: MemberRepository,
    private readonly membershipRepo: MinistryMembershipRepository,
  ) {}

  async execute(dto: UpdateMemberDTO): Promise<Member> {
    const member = await this.memberRepo.findById(dto.id);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    const updated = member.update({ name: dto.name, role: dto.role, active: dto.active });
    const saved = await this.memberRepo.update(updated);

    if (saved.role === 'MEMBRO' && member.role !== 'MEMBRO') {
      await this.clearAdminLinks(saved.id);
    }

    return saved;
  }

  /** Rebaixa todos os vínculos em que a pessoa administrava. */
  private async clearAdminLinks(memberId: string): Promise<void> {
    const views = await this.membershipRepo.findMinistriesByMember(memberId);
    for (const view of views) {
      if (view.membership.isAdmin) {
        await this.membershipRepo.update(view.membership.setAdmin(false));
      }
    }
  }
}
