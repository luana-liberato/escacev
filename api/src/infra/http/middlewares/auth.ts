import { RequestHandler } from 'express';
import { PerfilUsuario } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { JwtService } from '../../services/jwt';

/**
 * Dados do usuário autenticado, injetados em req.user pelo middleware auth.
 * O institutionId vem SEMPRE do JWT — nunca do body da request (Seção 4.5).
 */
export interface AuthenticatedUser {
  memberId: string;
  institutionId: string;
  role: PerfilUsuario;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Estende o User do passport/express com o nosso payload autenticado,
    // mantendo req.user com um único tipo coerente em toda a aplicação.
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AuthenticatedUser {}
  }
}

const jwtService = new JwtService();

/**
 * Extrai o Bearer token do header Authorization, valida o JWT e injeta
 * req.user = { membroId, instituicaoId, perfil }. Responde 401 se o token
 * estiver ausente ou inválido (AppError é tratado pelo errorHandler).
 *
 * LOGOUT: com JWT stateless não há endpoint de logout — o cliente apenas
 * descarta o token. Não existe lista de revogação no MVP.
 */
export const auth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token de autenticação ausente', 401);
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError('Token de autenticação ausente', 401);
  }

  const payload = jwtService.verify(token);
  req.user = {
    memberId: payload.memberId,
    institutionId: payload.institutionId,
    role: payload.role,
  };

  next();
};
