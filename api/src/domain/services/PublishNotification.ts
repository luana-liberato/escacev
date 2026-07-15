import { Schedule } from '../entities/Schedule';
import { AssignmentRepository } from '../repositories/AssignmentRepository';
import { EventRepository } from '../repositories/EventRepository';
import { Notifier } from './Notifier';

/**
 * Notifica os membros escalados quando uma escala é publicada (RN04, Fase 7) e,
 * se algum e-mail não puder ser enviado, avisa o publicador com uma notificação
 * in-app do tipo SISTEMA. Extraído do PublishScheduleUseCase para manter o use
 * case enxuto e tornar o fan-out testável isoladamente.
 *
 * Roda em segundo plano (via BackgroundTasks): não deve lançar para o request —
 * o executor de background captura e loga qualquer erro. Por isso este serviço
 * não engole exceções: quem o dispara é que decide o isolamento.
 */
export class PublishNotification {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly eventRepo: EventRepository,
    private readonly notifier: Notifier,
  ) {}

  /** Notifica os escalados da escala; reporta ao publicador se algum e-mail falhar. */
  async notify(schedule: Schedule, publisherId: string): Promise<void> {
    const event = await this.eventRepo.findById(schedule.eventId);
    if (!event) return; // sem evento resolvível, não há o que notificar

    const details = await this.assignmentRepo.findByScheduleWithDetails(schedule.id);
    if (details.length === 0) return; // escala vazia: ninguém a notificar

    let failures = 0;
    for (const { member, position } of details) {
      const delivered = await this.notifier.memberScheduled({
        memberId: member.id,
        email: member.email,
        memberName: member.name,
        eventName: event.name,
        startsAt: event.startsAt,
        positionName: position.name,
      });
      if (!delivered) failures += 1;
    }

    // Se algum e-mail não saiu, avisa quem publicou (in-app; o e-mail é o canal
    // que falhou). O aviso in-app aos escalados já foi gravado de qualquer forma.
    if (failures > 0) {
      await this.notifier.systemNotice({
        memberId: publisherId,
        title: 'Alguns e-mails da escala não foram enviados',
        body:
          `${failures} de ${details.length} e-mail(s) de "${event.name}" não puderam ser enviados. ` +
          `Os avisos in-app foram registrados; verifique os endereços ou tente reenviar.`,
      });
    }
  }
}
