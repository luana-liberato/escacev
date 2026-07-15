import { Notification } from '../../../entities/Notification';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { CreateNotificationUseCase } from '../CreateNotificationUseCase';
import { ListMyNotificationsUseCase } from '../ListMyNotificationsUseCase';
import { MarkNotificationReadUseCase } from '../MarkNotificationReadUseCase';

/**
 * Fake em memória do NotificationRepository — não toca o banco. Cobre a
 * orquestração dos use cases isoladamente (nível unitário).
 */
class FakeNotificationRepository implements NotificationRepository {
  items: Notification[] = [];

  async findById(id: string): Promise<Notification | null> {
    return this.items.find((n) => n.id === id) ?? null;
  }

  async findByMember(memberId: string): Promise<Notification[]> {
    return this.items
      .filter((n) => n.memberId === memberId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // mais recentes primeiro
  }

  async countUnread(memberId: string): Promise<number> {
    return this.items.filter((n) => n.memberId === memberId && !n.read).length;
  }

  async save(notification: Notification): Promise<Notification> {
    this.items.push(notification);
    return notification;
  }

  async markAsRead(notification: Notification): Promise<Notification> {
    this.items = this.items.map((n) => (n.id === notification.id ? notification : n));
    return notification;
  }
}

describe('CreateNotificationUseCase', () => {
  it('cria uma notificação não lida para o destinatário', async () => {
    const repo = new FakeNotificationRepository();
    const useCase = new CreateNotificationUseCase(repo);

    const n = await useCase.execute({
      memberId: 'm1',
      type: 'ESCALADO',
      title: 'Você foi escalado',
      body: 'Culto de domingo, 10h — função Recepção.',
    });

    expect(n.id).toBeTruthy();
    expect(n.memberId).toBe('m1');
    expect(n.type).toBe('ESCALADO');
    expect(n.read).toBe(false);
    expect(repo.items).toHaveLength(1);
  });

  it('rejeita tipo de notificação inválido', async () => {
    const repo = new FakeNotificationRepository();
    const useCase = new CreateNotificationUseCase(repo);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useCase.execute({ memberId: 'm1', type: 'FOO' as any, title: 'x', body: 'y' }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(repo.items).toHaveLength(0);
  });

  it('rejeita título vazio', async () => {
    const repo = new FakeNotificationRepository();
    const useCase = new CreateNotificationUseCase(repo);

    await expect(
      useCase.execute({ memberId: 'm1', type: 'LEMBRETE', title: '   ', body: 'y' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('ListMyNotificationsUseCase', () => {
  it('lista só as do próprio membro, mais recentes primeiro', async () => {
    const repo = new FakeNotificationRepository();
    const createUC = new CreateNotificationUseCase(repo);
    const listUC = new ListMyNotificationsUseCase(repo);

    await createUC.execute({ memberId: 'm1', type: 'ESCALADO', title: 'Antiga', body: 'b' });
    // pequena espera lógica: como createdAt usa new Date(), força ordem manipulando o item.
    await createUC.execute({ memberId: 'm1', type: 'LEMBRETE', title: 'Nova', body: 'b' });
    await createUC.execute({ memberId: 'm2', type: 'TROCA', title: 'De outro', body: 'b' });

    const mine = await listUC.execute({ memberId: 'm1' });

    expect(mine).toHaveLength(2);
    expect(mine.every((n) => n.memberId === 'm1')).toBe(true);
    expect(mine[0].createdAt.getTime()).toBeGreaterThanOrEqual(mine[1].createdAt.getTime());
  });
});

describe('MarkNotificationReadUseCase', () => {
  it('marca a notificação do próprio membro como lida', async () => {
    const repo = new FakeNotificationRepository();
    const createUC = new CreateNotificationUseCase(repo);
    const markUC = new MarkNotificationReadUseCase(repo);

    const n = await createUC.execute({ memberId: 'm1', type: 'ESCALADO', title: 't', body: 'b' });
    expect(await repo.countUnread('m1')).toBe(1);

    const read = await markUC.execute({ id: n.id, memberId: 'm1' });

    expect(read.read).toBe(true);
    expect(await repo.countUnread('m1')).toBe(0);
  });

  it('é idempotente: marcar de novo uma já lida não quebra', async () => {
    const repo = new FakeNotificationRepository();
    const createUC = new CreateNotificationUseCase(repo);
    const markUC = new MarkNotificationReadUseCase(repo);

    const n = await createUC.execute({ memberId: 'm1', type: 'ESCALADO', title: 't', body: 'b' });
    await markUC.execute({ id: n.id, memberId: 'm1' });
    const again = await markUC.execute({ id: n.id, memberId: 'm1' });

    expect(again.read).toBe(true);
    expect(await repo.countUnread('m1')).toBe(0);
  });

  it('404 ao marcar notificação de outro membro (não vaza dados de terceiro)', async () => {
    const repo = new FakeNotificationRepository();
    const createUC = new CreateNotificationUseCase(repo);
    const markUC = new MarkNotificationReadUseCase(repo);

    const n = await createUC.execute({ memberId: 'm1', type: 'ESCALADO', title: 't', body: 'b' });

    await expect(markUC.execute({ id: n.id, memberId: 'm2' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(await repo.countUnread('m1')).toBe(1); // não marcou
  });

  it('404 quando a notificação não existe', async () => {
    const repo = new FakeNotificationRepository();
    const markUC = new MarkNotificationReadUseCase(repo);

    await expect(
      markUC.execute({ id: 'inexistente', memberId: 'm1' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
