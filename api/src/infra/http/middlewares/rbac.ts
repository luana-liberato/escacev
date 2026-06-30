import { RequestHandler } from 'express';
import { PerfilUsuario } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Restringe a rota aos perfis informados, comparando com req.user.role.
 * Deve ser usado SEMPRE depois do middleware auth (que popula req.user).
 * Responde 401 se não autenticado e 403 se o perfil não for permitido.
 */
export const rbac =
  (...allowedRoles: PerfilUsuario[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Acesso negado para o seu perfil', 403);
    }

    next();
  };
