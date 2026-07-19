import { Schedule } from '../entities/Schedule';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';
import { Actor } from './MinistryAccessPolicy';

/**
 * Guarda de LEITURA de escalas — "quais escalas este ator ENXERGA?", por
 * ministério. Complementa a MinistryAccessPolicy (que responde "pode ADMINISTRAR
 * este ministério?"): ver não é o mesmo que editar.
 *
 * Regra, avaliada pelo ministério de cada escala:
 *  - ADMIN_GERAL: vê todas (papel de instituição, Seção 1 do CLAUDE.md);
 *  - quem ADMINISTRA o ministério (ADMIN_MINISTERIO com isAdmin lá): vê todas as
 *    daquele ministério, inclusive RASCUNHO;
 *  - quem só PARTICIPA do ministério (vínculo sem isAdmin, ou papel MEMBRO): só as
 *    PUBLICADA (RN04 — rascunho é invisível a quem não administra);
 *  - quem não participa: nenhuma.
 *
 * Com isso o ADMIN_MINISTERIO revê as escalas de TODOS os ministérios que participa
 * — como membro (só publicadas) ou como admin (inclusive rascunho) —, mas a EDIÇÃO
 * continua restrita aos que administra (isso é papel da MinistryAccessPolicy).
 * Depende só do contrato do repositório (Seção 4.2); reutilizada na listagem e na
 * leitura por id (inclusive a de conflitos).
 */
export class ScheduleVisibilityPolicy {
  constructor(private readonly membershipRepo: MinistryMembershipRepository) {}

  /** true se o ator pode ENXERGAR esta escala; não lança. */
  async canView(actor: Actor, schedule: Schedule): Promise<boolean> {
    if (actor.role === 'ADMIN_GERAL') return true;

    const membership = await this.membershipRepo.findByMemberAndMinistry(
      actor.memberId,
      schedule.ministryId,
    );
    if (!membership) return false;

    const manages = actor.role === 'ADMIN_MINISTERIO' && membership.isAdmin;
    return manages || schedule.status === 'PUBLICADA';
  }

  /**
   * Filtra a lista às escalas que o ator enxerga. Resolve o vínculo uma vez por
   * ministério presente no resultado (o N é o nº de ministérios da lista, pequeno
   * numa igreja) e aplica a regra acima a cada escala.
   */
  async filterVisible(actor: Actor, schedules: Schedule[]): Promise<Schedule[]> {
    if (actor.role === 'ADMIN_GERAL') return schedules;

    const manages = new Set<string>();
    const participates = new Set<string>();
    for (const ministryId of new Set(schedules.map((s) => s.ministryId))) {
      const membership = await this.membershipRepo.findByMemberAndMinistry(actor.memberId, ministryId);
      if (!membership) continue;
      participates.add(ministryId);
      if (actor.role === 'ADMIN_MINISTERIO' && membership.isAdmin) manages.add(ministryId);
    }

    return schedules.filter((s) => {
      if (manages.has(s.ministryId)) return true;
      if (participates.has(s.ministryId)) return s.status === 'PUBLICADA';
      return false;
    });
  }
}
