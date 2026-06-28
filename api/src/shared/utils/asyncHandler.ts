import { RequestHandler } from 'express';

/**
 * Envolve um handler async e encaminha qualquer rejeição ao next(err),
 * para que o errorHandler trate. Toda rota deve usar este wrapper.
 */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
