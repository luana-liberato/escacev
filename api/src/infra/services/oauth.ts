import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

/**
 * Configura a estratégia Google OAuth 2.0 (escopos email + profile).
 * A verify callback apenas repassa o perfil do Google; toda a lógica de
 * vínculo Account/Member fica no AuthenticateWithGoogleUseCase (controller).
 * Uso stateless (session: false) — nenhuma sessão de servidor é criada.
 */
export function configureGoogleStrategy(): void {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL;

  if (!clientID || !clientSecret || !callbackURL) {
    throw new Error(
      'Credenciais do Google OAuth ausentes: defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_CALLBACK_URL no .env',
    );
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      (_accessToken, _refreshToken, profile, done) => {
        // Repassa o perfil do Google em req.user; o controller o normaliza.
        // Cast necessário: req.user é tipado como o nosso AuthenticatedUser.
        done(null, profile as unknown as Express.User);
      },
    ),
  );
}
