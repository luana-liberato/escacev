import { Router, RequestHandler } from 'express';
import passport from 'passport';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AuthController } from '../controllers/AuthController';
import { AppError } from '../../../shared/errors/AppError';

export const authRoutes = Router();
const controller = new AuthController();

// Inicia o fluxo: redireciona para a tela de consentimento do Google.
authRoutes.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'], session: false }),
);

/**
 * Autentica o callback com um callback CUSTOMIZADO do passport, em vez do
 * middleware direto. Motivo: quando o próprio passport falha — o usuário nega o
 * consentimento, o `code` expira, o Google recusa — ele responde sozinho e o
 * AuthController nunca roda; nenhum try/catch lá dentro pegaria isso. Aqui a
 * falha vira o mesmo redirect com `?error=` do resto do fluxo, para o front ter
 * um único caminho de erro (ver o comentário no AuthController).
 */
const authenticateGoogleCallback: RequestHandler = (req, res, next) => {
  passport.authenticate(
    'google',
    { session: false },
    (err: unknown, profile: Express.User | false) => {
      if (err || !profile) {
        const failure = err ?? new AppError('Falha na autenticação com o Google', 401);
        // Sem FRONTEND_URL, mantém o comportamento antigo: errorHandler -> JSON.
        if (!AuthController.redirectError(res, failure)) {
          next(failure);
        }
        return;
      }

      req.user = profile;
      next();
    },
  )(req, res, next);
};

// Callback: o passport troca o code por tokens e popula req.user com o perfil;
// o controller emite o JWT e redireciona ao front (ou devolve JSON, sem front).
authRoutes.get(
  '/auth/google/callback',
  authenticateGoogleCallback,
  asyncHandler(controller.googleCallback),
);
