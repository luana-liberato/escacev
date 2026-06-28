import { RequestHandler } from 'express';
import { PerfilUsuario } from '@prisma/client';

/**
 * Restringe a rota aos perfis informados, comparando com req.user.perfil.
 * TODO(rbac): implementar a checagem na fase de autenticação.
 */
export const rbac =
  (..._perfisPermitidos: PerfilUsuario[]): RequestHandler =>
  (_req, _res, next) => {
    next();
  };
