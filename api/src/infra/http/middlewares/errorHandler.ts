import { ErrorRequestHandler } from 'express';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Middleware final de erros. Converte AppError em resposta padronizada
 * e trata qualquer outro erro como 500. Registrado por último no app.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, data: null, message: err.message });
    return;
  }

  console.error('[errorHandler] erro não tratado:', err);
  res.status(500).json({ success: false, data: null, message: 'Erro interno do servidor' });
};
