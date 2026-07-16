import { Request, Response } from 'express';
import type { Profile } from 'passport-google-oauth20';
import { AuthenticateWithGoogleUseCase } from '../../../domain/use-cases/auth/AuthenticateWithGoogleUseCase';
import { PrismaAccountRepository } from '../../database/repositories/PrismaAccountRepository';
import { PrismaMemberRepository } from '../../database/repositories/PrismaMemberRepository';
import { JwtService } from '../../services/jwt';
import { AppError } from '../../../shared/errors/AppError';
import { respond } from '../../../shared/utils/respond';

/**
 * Chaves de erro que o front conhece e traduz em mensagem
 * (`web/src/pages/loginErrors.ts`). Viajam na query do redirect: a API diz O QUE
 * aconteceu, o front decide COMO escrever. Mandar a frase pronta exporia texto na
 * barra de endereço e permitiria forjar um aviso falso num link.
 */
export type LoginErrorKey = 'auth_failed' | 'no_email' | 'not_authorized' | 'api_error';

export class AuthController {
  /**
   * Callback do Google OAuth. O passport já validou o code e populou req.user
   * com o perfil do Google. Aqui normalizamos o perfil, rodamos o use case e
   * devolvemos o JWT — redirecionando para o front (se FRONTEND_URL existir)
   * ou retornando como JSON (para testar antes do frontend existir).
   *
   * EXCEÇÃO DELIBERADA À ARQUITETURA: as demais rotas deixam o AppError subir
   * para o errorHandler, que responde { success, data, message }. Esta captura.
   * O motivo é o cliente: aqui do outro lado está um NAVEGADOR navegando, não um
   * consumidor de API. Corpo JSON não é acionável por ele — o navegador exibiria
   * o texto cru na tela, parado no endereço da API, e o front nunca teria chance
   * de mostrar o erro. Redirect é a única instrução que ele obedece numa
   * navegação.
   */
  googleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
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

      const frontendUrl = AuthController.frontendUrl();
      if (frontendUrl) {
        const redirectUrl = new URL(frontendUrl);
        redirectUrl.searchParams.set('token', token);
        res.redirect(redirectUrl.toString());
        return;
      }

      // Sem FRONTEND_URL: devolve o token em JSON para teste manual (Postman/browser).
      respond(res, 200, { token }, 'Autenticação realizada com sucesso');
    } catch (error) {
      // Sem front configurado, o comportamento antigo vale também para o erro:
      // deixa subir e o errorHandler responde JSON.
      if (!AuthController.redirectError(res, error)) {
        throw error;
      }
    }
  };

  /**
   * Redireciona a falha para o front com a chave do erro na query. Devolve false
   * quando não há FRONTEND_URL — aí quem chama decide (o controller relança; a
   * rota chama next()), preservando o modo "API sem front" do .env.example.
   *
   * Público porque a rota também precisa: quando o próprio passport falha (o
   * usuário nega o consentimento, o code expira), ele responde antes e o
   * controller nunca roda.
   */
  static redirectError(res: Response, error: unknown): boolean {
    const frontendUrl = AuthController.frontendUrl();
    if (!frontendUrl) return false;

    const url = new URL(frontendUrl);
    url.searchParams.set('error', AuthController.toErrorKey(error));
    res.redirect(url.toString());
    return true;
  }

  /** FRONTEND_URL normalizada; string vazia (o default do .env.example) conta como ausente. */
  private static frontendUrl(): string | undefined {
    return process.env.FRONTEND_URL?.trim() || undefined;
  }

  /**
   * Traduz o erro na chave que o front espera, pelo statusCode:
   * - 403 -> not_authorized ('Usuário não autorizado', AuthenticateWithGoogleUseCase)
   * - 401 -> auth_failed    ('Falha na autenticação com o Google' e falha do passport)
   * - 400 -> no_email       ('Conta Google sem e-mail disponível')
   * - resto -> api_error    (fallback: qualquer coisa inesperada, inclusive 500)
   *
   * Ressalva conhecida: `Account.create` também lança 400 ('googleSub é
   * obrigatório'), que cairia em no_email — mensagem imprecisa. É inalcançável na
   * prática (o googleSub vem do passport e o e-mail já foi checado acima), e
   * distinguir não compensa hoje.
   */
  private static toErrorKey(error: unknown): LoginErrorKey {
    if (error instanceof AppError) {
      if (error.statusCode === 403) return 'not_authorized';
      if (error.statusCode === 401) return 'auth_failed';
      if (error.statusCode === 400) return 'no_email';
    }
    return 'api_error';
  }
}
