import { Notifier } from '../domain/services/Notifier';

/**
 * Notifier de teste que apenas registra as chamadas (não envia nada). Usado nos
 * unitários dos gatilhos da Fase 7 (convite, publicação, indisponibilidade) para
 * afirmar QUE e COM QUAIS dados o use case notificou, sem tocar e-mail nem banco.
 * Reusável entre suítes — evita reimplementar o fake em cada arquivo.
 */
export class RecordingNotifier implements Notifier {
  /** Controla o retorno de memberScheduled: true = e-mail "entregue"; false = falha. */
  deliverScheduledEmail = true;

  invited: Array<{ to: string; memberName: string }> = [];
  scheduled: Array<{ memberId: string; email: string; eventName: string; positionName: string }> = [];
  conflicts: Array<{ adminId: string; adminEmail: string; memberName: string; eventName: string }> = [];
  systemNotices: Array<{ memberId: string; title: string; body: string }> = [];

  async memberInvited(input: { to: string; memberName: string }): Promise<void> {
    this.invited.push(input);
  }

  async memberScheduled(input: {
    memberId: string;
    email: string;
    memberName: string;
    eventName: string;
    startsAt: Date;
    positionName: string;
  }): Promise<boolean> {
    this.scheduled.push({
      memberId: input.memberId,
      email: input.email,
      eventName: input.eventName,
      positionName: input.positionName,
    });
    return this.deliverScheduledEmail;
  }

  async unavailabilityConflict(input: {
    adminId: string;
    adminEmail: string;
    adminName: string;
    memberName: string;
    eventName: string;
    startsAt: Date;
  }): Promise<void> {
    this.conflicts.push({
      adminId: input.adminId,
      adminEmail: input.adminEmail,
      memberName: input.memberName,
      eventName: input.eventName,
    });
  }

  async systemNotice(input: { memberId: string; title: string; body: string }): Promise<void> {
    this.systemNotices.push(input);
  }
}
