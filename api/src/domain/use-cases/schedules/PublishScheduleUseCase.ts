import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { Notifier } from '../../services/Notifier';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface PublishScheduleDTO {
  institutionId: string;
  actor: Actor;
  id: string;
}

/**
 * Publica uma escala (RASCUNHO → PUBLICADA, RN04): a partir daqui ela fica
 * visível ao membro. É uma ESCRITA de escopo de ministério — reusa a
 * MinistryAccessPolicy (ADMIN_GERAL em qualquer, ou ADMIN_MINISTERIO com isAdmin
 * naquele ministério). Valida o tenant pela instituição do ministério da escala
 * (a Escala não tem instituicaoId próprio) e responde 404 quando não existe ou é
 * de outra instituição, sem vazar recursos de outro tenant.
 *
 * A transição e o carimbo de `publicadaEm` vivem na entidade (`Schedule.publish`),
 * que bloqueia republicar (409) para preservar a data da 1ª publicação — base da
 * precedência por publicação (RN07). A ordem 404 → 403 → 409 garante que o 409 de
 * "já publicada" só apareça a quem tem permissão. Dependências via construtor (4.2).
 *
 * Ao publicar (RN04), notifica cada membro escalado (Fase 7): a escala passa a ser
 * visível ao membro, então é o momento de avisá-lo. O bloco de notificação é
 * best-effort e isolado em try/catch — nem a coleta de dados nem o envio quebram a
 * publicação (o Notifier já é não-lançante; o try/catch protege as leituras).
 */
export class PublishScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly eventRepo: EventRepository,
    private readonly notifier: Notifier,
  ) {}

  async execute(dto: PublishScheduleDTO): Promise<Schedule> {
    const schedule = await this.scheduleRepo.findById(dto.id);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    const published = schedule.publish();
    const saved = await this.scheduleRepo.update(published);

    await this.notifyScheduledMembers(saved);
    return saved;
  }

  /**
   * Avisa cada membro escalado que a escala foi publicada. Isolado e não-lançante:
   * uma falha aqui (leitura de evento/alocações ou envio) apenas loga — a
   * publicação já está persistida e não deve ser revertida por um problema de
   * notificação (efeito colateral, fora da transação da operação).
   */
  private async notifyScheduledMembers(schedule: Schedule): Promise<void> {
    try {
      const event = await this.eventRepo.findById(schedule.eventId);
      if (!event) return; // sem evento resolvível, não há o que notificar

      const details = await this.assignmentRepo.findByScheduleWithDetails(schedule.id);
      for (const { member, position } of details) {
        await this.notifier.memberScheduled({
          memberId: member.id,
          email: member.email,
          memberName: member.name,
          eventName: event.name,
          startsAt: event.startsAt,
          positionName: position.name,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[notificacao:erro] falha ao notificar escalados da publicação:', err);
    }
  }
}
