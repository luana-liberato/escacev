import { Router } from 'express';
import passport from 'passport';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AuthController } from '../controllers/AuthController';

export const authRoutes = Router();
const controller = new AuthController();

// Inicia o fluxo: redireciona para a tela de consentimento do Google.
authRoutes.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'], session: false }),
);

// Callback: o passport troca o code por tokens e popula req.user com o perfil;
// o controller emite o JWT. failureRedirect desligado → 401 em caso de falha.
authRoutes.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureMessage: true }),
  asyncHandler(controller.googleCallback),
);
