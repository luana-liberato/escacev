import { BackgroundTasks } from '../domain/services/BackgroundTasks';

/**
 * BackgroundTasks de teste: executa a tarefa de imediato mas guarda a promessa,
 * para o teste aguardar sua conclusão de forma determinística (`await settle()`).
 * Assim o fire-and-forget do use case fica testável sem race — diferente do
 * DetachedBackgroundTasks de produção, que solta a tarefa e não é aguardável.
 */
export class SyncBackgroundTasks implements BackgroundTasks {
  private readonly tasks: Promise<void>[] = [];

  run(task: () => Promise<void>): void {
    this.tasks.push(task());
  }

  /** Aguarda todas as tarefas disparadas até aqui. */
  async settle(): Promise<void> {
    await Promise.all(this.tasks);
  }
}
