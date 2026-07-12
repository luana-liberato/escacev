import { Request, Response } from 'express';
import type { Profile } from 'passport-google-oauth20';
import { AuthenticateWithGoogleUseCase } from '../../../domain/use-cases/auth/AuthenticateWithGoogleUseCase';
import { PrismaAccountRepository } from '../../database/repositories/PrismaAccountRepository';
import { PrismaMemberRepository } from '../../database/repositories/PrismaMemberRepository';
import { JwtService } from '../../services/jwt';
import { AppError } from '../../../shared/errors/AppError';
import { respond } from '../../../shared/utils/respond';

export class AuthController {
  /**
   * Callback do Google OAuth. O passport já validou o code e populou req.user
   * com o perfil do Google. Aqui normalizamos o perfil, rodamos o use case e
   * devolvemos o JWT — redirecionando para o front (se FRONTEND_URL existir)
   * ou retornando como JSON (para testar antes do frontend existir).
   */
  googleCallback = async (req: Request, res: Response): Promise<void> => {
    const profile = req.user as unknown as Profile | undefined;
    if (!profile) {
      throw new AppError('Falha na autenticação com o Google', 401);
    }

    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new AppError('Conta Google sem e-mail disponível', 400);
    }

    const useCase = new AuthenticateWithGoogleUseCase(
      new PrismaAccountRepository(),
      new PrismaMemberRepository(),
      new JwtService(),
    );

    const { token } = await useCase.execute({
      googleSub: profile.id,
      email,
      name: profile.displayName ?? email,
      photoUrl: profile.photos?.[0]?.value,
    });

    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl) {
      const redirectUrl = new URL(frontendUrl);
      redirectUrl.searchParams.set('token', token);
      res.redirect(redirectUrl.toString());
      return;
    }

    // Sem FRONTEND_URL: devolve o token em JSON para teste manual (Postman/browser).
    respond(res, 200, { token }, 'Autenticação realizada com sucesso');
  };
}
