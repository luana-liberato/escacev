import type { Transporter } from 'nodemailer';
import { NodemailerEmailService, EmailService, EmailMessage } from '../email';
import { AppNotifier } from '../AppNotifier';
import { CreateNotificationUseCase } from '../../../domain/use-cases/notifications/CreateNotificationUseCase';
import { Notification } from '../../../domain/entities/Notification';
import { NotificationRepository } from '../../../domain/repositories/NotificationRepository';

/** Fake do NotificationRepository — reaproveitado nos testes do Notifier. */
class FakeNotificationRepository implements NotificationRepository {
  items: Notification[] = [];
  saveShouldThrow = false;
  async findById(id: string) {
    return this.items.find((n) => n.id === id) ?? null;
  }
  async findByMember(memberId: string) {
    return this.items.filter((n) => n.memberId === memberId);
  }
  async countUnread(memberId: string) {
    return this.items.filter((n) => n.memberId === memberId && !n.read).length;
  }
  async save(n: Notification) {
    if (this.saveShouldThrow) throw new Error('banco fora');
    this.items.push(n);
    return n;
  }
  async markAsRead(n: Notification) {
    return n;
  }
}

/** Fake do EmailService — registra as mensagens em vez de enviar. */
class FakeEmailService implements EmailService {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe('NodemailerEmailService', () => {
  it('modo log: sem SMTP configurado, não envia e não lança', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    // Config sem host/user/pass → não configurado → modo log.
    const service = new NodemailerEmailService({ config: { port: 587, from: 'noreply@escacev.app' } });

    await expect(
      service.send({ to: 'a@b.c', subject: 'Oi', html: '<p>oi</p>', text: 'oi' }),
    ).resolves.toBeUndefined();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('SMTP não configurado'));
    info.mockRestore();
  });

  it('configurado: envia via transporter com from/to/subject/html/text', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const transporter = { sendMail } as unknown as Transporter;
    const service = new NodemailerEmailService({
      config: { host: 'smtp.test', port: 587, user: 'u', pass: 'p', from: 'noreply@escacev.app' },
      transporter,
    });

    await service.send({ to: 'a@b.c', subject: 'Assunto', html: '<p>x</p>', text: 'x' });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@escacev.app',
        to: 'a@b.c',
        subject: 'Assunto',
        html: '<p>x</p>',
        text: 'x',
      }),
    );
  });

  it('best-effort: falha do transporter é engolida (send não lança)', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP caiu'));
    const transporter = { sendMail } as unknown as Transporter;
    const service = new NodemailerEmailService({
      config: { host: 'smtp.test', port: 587, user: 'u', pass: 'p', from: 'f@x.y' },
      transporter,
    });

    await expect(
      service.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' }),
    ).resolves.toBeUndefined();

    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('placeholder "..." do template .env conta como não configurado (modo log)', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const service = new NodemailerEmailService({
      config: { host: 'smtp.mailtrap.io', port: 587, user: '...', pass: '...', from: 'f@x.y' },
    });

    await service.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' });

    expect(info).toHaveBeenCalledWith(expect.stringContaining('SMTP não configurado'));
    info.mockRestore();
  });
});

describe('AppNotifier', () => {
  const buildNotifier = () => {
    const repo = new FakeNotificationRepository();
    const email = new FakeEmailService();
    const notifier = new AppNotifier(new CreateNotificationUseCase(repo), email);
    return { repo, email, notifier };
  };

  it('memberScheduled: grava notificação in-app ESCALADO e envia e-mail', async () => {
    const { repo, email, notifier } = buildNotifier();

    await notifier.memberScheduled({
      memberId: 'm1',
      email: 'm1@ex.com',
      memberName: 'João',
      eventName: 'Culto de Domingo',
      startsAt: new Date('2026-08-02T13:00:00Z'),
      positionName: 'Recepção',
    });

    expect(repo.items).toHaveLength(1);
    expect(repo.items[0]).toMatchObject({ memberId: 'm1', type: 'ESCALADO' });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe('m1@ex.com');
    expect(email.sent[0].subject).toContain('Culto de Domingo');
  });

  it('memberInvited: e-mail-only, usa INSTITUTION_NAME e o link de login (APP_LOGIN_URL) do ambiente', async () => {
    const { repo, email, notifier } = buildNotifier();
    const prevInst = process.env.INSTITUTION_NAME;
    const prevLogin = process.env.APP_LOGIN_URL;
    process.env.INSTITUTION_NAME = 'Minha Igreja';
    process.env.APP_LOGIN_URL = 'https://app.exemplo.test/auth/google';

    try {
      await notifier.memberInvited({ to: 'novo@ex.com', memberName: 'Maria' });
    } finally {
      process.env.INSTITUTION_NAME = prevInst;
      process.env.APP_LOGIN_URL = prevLogin;
    }

    expect(repo.items).toHaveLength(0);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe('novo@ex.com');
    expect(email.sent[0].subject).toContain('Minha Igreja');
    // O link de acesso aparece no HTML (href) e no texto puro.
    expect(email.sent[0].html).toContain('href="https://app.exemplo.test/auth/google"');
    expect(email.sent[0].text).toContain('https://app.exemplo.test/auth/google');
  });

  it('robustez: falha ao gravar in-app não impede o e-mail nem lança', async () => {
    const { repo, email, notifier } = buildNotifier();
    repo.saveShouldThrow = true;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      notifier.memberScheduled({
        memberId: 'm1',
        email: 'm1@ex.com',
        memberName: 'João',
        eventName: 'Culto',
        startsAt: new Date('2026-08-02T13:00:00Z'),
        positionName: 'Recepção',
      }),
    ).resolves.toBeUndefined();

    expect(repo.items).toHaveLength(0); // não gravou
    expect(email.sent).toHaveLength(1); // mas enviou o e-mail
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('unavailabilityConflict: grava in-app para o admin e envia e-mail', async () => {
    const { repo, email, notifier } = buildNotifier();

    await notifier.unavailabilityConflict({
      adminId: 'admin1',
      adminEmail: 'admin@ex.com',
      adminName: 'Ana',
      memberName: 'João',
      eventName: 'Culto',
      startsAt: new Date('2026-08-02T13:00:00Z'),
    });

    expect(repo.items).toHaveLength(1);
    expect(repo.items[0]).toMatchObject({ memberId: 'admin1', type: 'INDISPONIBILIDADE_CONFLITO' });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe('admin@ex.com');
  });
});
