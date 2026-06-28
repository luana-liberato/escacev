import { RequestHandler } from 'express';
import { PerfilUsuario } from '@prisma/client';

/**
 * Dados do usuário autenticado, injetados em req.user pelo middleware auth.
 * O instituicaoId vem SEMPRE do JWT — nunca do body da request.
 */
export interface AuthenticatedUser {
  membroId: string;
  instituicaoId: string;
  perfil: PerfilUsuario;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Valida o JWT e injeta req.user.
 * TODO(auth): implementar verificação de token na fase de autenticação.
 */
export const auth: RequestHandler = (_req, _res, next) => {
  next();
};
