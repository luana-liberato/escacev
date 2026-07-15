import { Unavailability } from '../../entities/Unavailability';
import { UnavailabilityRepository } from '../../repositories/UnavailabilityRepository';
import {
  AssignmentRepository,
  MemberAssignmentContext,
} from '../../repositories/AssignmentRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { Notifier } from '../../services/Notifier';

/** memberId vem do JWT (req.user), nunca do body — o membro registra a PRÓPRIA. */
export interface CreateUnavailabilityDTO {
  memberId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

/**
 * Registra uma indisponibilidade do próprio membro (RN05). A validação do
 * intervalo (endsAt > startsAt) e do motivo mora na entidade; o use case
 * orquestra e persiste.
 *
 * Ao registrar, alerta os admins dos ministérios cujas escalas JÁ PUBLICADAS têm
 * esse membro escalado num evento que se sobrepõe ao período (RN05, visão do
 * admin — Fase 7). O alerta é best-effort e isolado em try/catch: nem a coleta de
 * dados nem o envio quebram o registro da indisponibilidade (o Notifier já é
 * não-lançante; o try/catch protege as leituras). Dependências via construtor (4.2).
 */
export class CreateUnavailabilityUseCase {
  constructor(
    private readonly unavailabilityRepo: UnavailabilityRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly notifier: Notifier,
  ) {}

  async execute(dto: CreateUnavailabilityDTO): Promise<Unavailability> {
    const unavailability = Unavailability.create({
      memberId: dto.memberId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      reason: dto.reason,
    });
    const saved = await this.unavailabilityRepo.save(unavailability);

    await this.alertAdminsOfConflicts(saved);
    return saved;
  }

  /**
   * Alerta os admins dos ministérios afetados. "Afetado" = alocação do membro em
   * escala PUBLICADA (schedulePublishedAt != null) cujo evento se sobrepõe ao
   * período da indisponibilidade (mesma sobreposição estrita do motor de
   * conflito). Rascunho não conta (RN04). Isolado e não-lançante.
   */
  private async alertAdminsOfConflicts(unavailability: Unavailability): Promise<void> {
    try {
      const assignments = await this.assignmentRepo.findByMemberWithContext(
        unavailability.memberId,
      );
      const affected = assignments.filter(
        (a) =>
          a.schedulePublishedAt !== null &&
          a.startsAt < unavailability.endsAt &&
          a.endsAt > unavailability.startsAt,
      );
      if (affected.length === 0) return;

      // memberName repete o mesmo valor em todo o resultado (é sempre este membro).
      const memberName = affected[0].memberName;

      // Agrupa por ministério para buscar os admins uma vez por ministério.
      const byMinistry = new Map<string, MemberAssignmentContext[]>();
      for (const a of affected) {
        const list = byMinistry.get(a.ministryId) ?? [];
        list.push(a);
        byMinistry.set(a.ministryId, list);
      }

      for (const [ministryId, items] of byMinistry) {
        const admins = (await this.membershipRepo.findMembersByMinistry(ministryId)).filter(
          (v) => v.membership.isAdmin,
        );
        // Um evento por alerta (dedupe): salas diferentes do mesmo evento não repetem.
        const events = new Map<string, MemberAssignmentContext>();
        for (const it of items) events.set(it.eventId, it);

        for (const { member: admin } of admins) {
          // Não alerta o próprio membro que ficou indisponível, mesmo que seja admin.
          if (admin.id === unavailability.memberId) continue;
          for (const ev of events.values()) {
            await this.notifier.unavailabilityConflict({
              adminId: admin.id,
              adminEmail: admin.email,
              adminName: admin.name,
              memberName,
              eventName: ev.eventName,
              startsAt: ev.startsAt,
            });
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[notificacao:erro] falha ao alertar admins de indisponibilidade:', err);
    }
  }
}
