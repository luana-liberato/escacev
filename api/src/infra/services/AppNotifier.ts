import { Notifier } from '../../domain/services/Notifier';
import { CreateNotificationUseCase } from '../../domain/use-cases/notifications/CreateNotificationUseCase';
import { NotificationType } from '../../domain/entities/Notification';
import { EmailService } from './email';
import { inviteEmail, scheduledEmail, unavailabilityConflictEmail } from './emailTemplates';

/**
 * Implementação do Notifier (Fase 7). Compõe os dois canais:
 *  - in-app (canal CONFIÁVEL): reusa o CreateNotificationUseCase do S1;
 *  - e-mail (best-effort por cima): delega ao EmailService, que nunca lança.
 *
 * Honra o contrato de robustez da porta: nenhum método propaga erro. A gravação
 * in-app é envolvida em try/catch — uma falha de banco loga e segue, sem quebrar
 * a operação que disparou a notificação (ex.: publicar escala). Dependências via
 * construtor (Seção 4.2).
 */
export class AppNotifier implements Notifier {
  constructor(
    private readonly createNotification: CreateNotificationUseCase,
    private readonly emailService: EmailService,
  ) {}

  async memberInvited(input: { to: string; memberName: string }): Promise<void> {
    // E-mail-only: sem registro in-app (o convidado ainda não tem inbox). Nome da
    // instituição e URL de login vêm do ambiente (MVP single-institution) —
    // detalhe de infra, fora do domínio. A URL de login aponta para o início do
    // fluxo Google OAuth que vincula a conta ao membro convidado.
    const institutionName = process.env.INSTITUTION_NAME?.trim() || 'sua instituição';
    const loginUrl = process.env.APP_LOGIN_URL?.trim() || 'http://localhost:3001/auth/google';
    await this.emailService.send({
      to: input.to,
      ...inviteEmail({ memberName: input.memberName, institutionName, loginUrl }),
    });
  }

  async memberScheduled(input: {
    memberId: string;
    email: string;
    memberName: string;
    eventName: string;
    startsAt: Date;
    positionName: string;
  }): Promise<boolean> {
    await this.persist({
      memberId: input.memberId,
      type: 'ESCALADO',
      title: 'Você foi escalado',
      body: `${input.eventName} — função ${input.positionName}`,
    });
    // Devolve se o e-mail saiu (o in-app já foi gravado acima, canal confiável).
    return this.emailService.send({
      to: input.email,
      ...scheduledEmail({
        memberName: input.memberName,
        eventName: input.eventName,
        startsAt: input.startsAt,
        positionName: input.positionName,
      }),
    });
  }

  async systemNotice(input: { memberId: string; title: string; body: string }): Promise<void> {
    // In-app apenas (tipo SISTEMA): o canal que costuma falhar é o e-mail, então
    // um aviso de falha de e-mail não deve depender de e-mail.
    await this.persist({
      memberId: input.memberId,
      type: 'SISTEMA',
      title: input.title,
      body: input.body,
    });
  }

  async unavailabilityConflict(input: {
    adminId: string;
    adminEmail: string;
    adminName: string;
    memberName: string;
    eventName: string;
    startsAt: Date;
  }): Promise<void> {
    await this.persist({
      memberId: input.adminId,
      type: 'INDISPONIBILIDADE_CONFLITO',
      title: 'Indisponibilidade conflita com escala',
      body: `${input.memberName} ficou indisponível para ${input.eventName}`,
    });
    await this.emailService.send({
      to: input.adminEmail,
      ...unavailabilityConflictEmail({
        adminName: input.adminName,
        memberName: input.memberName,
        eventName: input.eventName,
        startsAt: input.startsAt,
      }),
    });
  }

  /** Grava a notificação in-app de forma não-lançante (canal confiável, mas fora da transação da operação). */
  private async persist(input: {
    memberId: string;
    type: NotificationType;
    title: string;
    body: string;
  }): Promise<void> {
    try {
      await this.createNotification.execute(input);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[notificacao:erro] falha ao gravar notificação in-app:', err);
    }
  }
}
