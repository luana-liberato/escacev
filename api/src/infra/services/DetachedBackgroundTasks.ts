import { BackgroundTasks } from '../../domain/services/BackgroundTasks';

/**
 * Implementação de produção do BackgroundTasks: dispara a tarefa desacoplada do
 * request (não aguarda) e captura qualquer erro logando — assim uma falha em
 * segundo plano nunca vira unhandled rejection. É o que permite o HTTP da
 * publicação responder na hora, com os e-mails saindo em seguida.
 */
export class DetachedBackgroundTasks implements BackgroundTasks {
  run(task: () => Promise<void>): void {
    void task().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[background:erro] tarefa em segundo plano falhou:', err);
    });
  }
}
