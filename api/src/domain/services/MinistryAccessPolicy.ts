import { PerfilUsuario } from '@prisma/client';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';
import { AppError } from '../../shared/errors/AppError';

/** Ator autenticado que tenta agir sobre um ministério (subset de req.user). */
export interface Actor {
  memberId: string;
  role: PerfilUsuario;
}

/**
 * Guarda única de escopo de ministério (bloco "Permissão Escopada" do CLAUDE.md):
 * "esta pessoa pode agir sobre este ministério?"
 *  - ADMIN_GERAL: sempre (poder sobre todos os ministérios pelo papel global);
 *  - ADMIN_MINISTERIO: só se tiver isAdmin = true NAQUELE ministério;
 *  - demais perfis: nunca.
 * Reutilizada na edição de ministério, nas associações e (próximos blocos) em
 * funções e escalas. Depende só do contrato do repositório (Seção 4.2).
 */
export class MinistryAccessPolicy {
  constructor(private readonly membershipRepo: MinistryMembershipRepository) {}

  /** true se o ator pode administrar o ministério; não lança. */
  async canManage(actor: Actor, ministryId: string): Promise<boolean> {
    if (actor.role === 'ADMIN_GERAL') return true;
    if (actor.role === 'ADMIN_MINISTERIO') {
      const membership = await this.membershipRepo.findByMemberAndMinistry(
        actor.memberId,
        ministryId,
      );
      return membership?.isAdmin ?? false;
    }
    return false;
  }

  /** Lança 403 quando o ator não pode administrar aquele ministério. */
  async ensureCanManage(actor: Actor, ministryId: string): Promise<void> {
    if (!(await this.canManage(actor, ministryId))) {
      throw new AppError('Você não administra este ministério', 403);
    }
  }
}
