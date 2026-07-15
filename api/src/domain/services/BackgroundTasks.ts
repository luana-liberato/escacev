/**
 * BackgroundTasks — porta para rodar um trabalho FORA do ciclo da requisição
 * (fire-and-forget). Use cases dependem desta interface, não da implementação:
 * em produção a tarefa roda desacoplada (o HTTP responde na hora); nos testes
 * roda de forma síncrona/aguardável, mantendo as asserções determinísticas.
 *
 * A tarefa é sempre não-crítica (ex.: enviar e-mails de notificação): seu
 * resultado não afeta a resposta da operação que a disparou.
 */
export interface BackgroundTasks {
  /** Enfileira/dispara a tarefa. Não lança e não bloqueia o chamador. */
  run(task: () => Promise<void>): void;
}
