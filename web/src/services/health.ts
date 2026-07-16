import { http } from './http';

export interface HealthData {
  status: string;
}

/**
 * GET /health — única rota pública (sem auth). A `message` da API é exibida na
 * tela de status, por isso usa `withMessage` em vez do unwrap simples.
 */
export function getHealth(): Promise<{ data: HealthData; message: string }> {
  return http.withMessage<HealthData>({ method: 'GET', url: '/health' });
}
