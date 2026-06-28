import { Response } from 'express';

/**
 * Padroniza o shape de resposta da API: { success, data, message }.
 * success é derivado do status (< 400 = sucesso).
 */
export function respond<T>(res: Response, status: number, data: T, message: string): Response {
  const success = status < 400;
  return res.status(status).json({
    success,
    data: success ? data : null,
    message,
  });
}
