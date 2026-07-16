import { Request, Response } from 'express';
import { AuthController } from '../AuthController';
import { AuthenticateWithGoogleUseCase } from '../../../../domain/use-cases/auth/AuthenticateWithGoogleUseCase';
import { AppError } from '../../../../shared/errors/AppError';

jest.mock('../../../../domain/use-cases/auth/AuthenticateWithGoogleUseCase');

/**
 * O callback do OAuth não é testável de ponta a ponta sem o Google real (o
 * Passport troca um `code` válido por tokens), então aqui exercitamos o
 * controller como unidade, com o use case mockado. O que importa provar é a
 * TRADUÇÃO: cada falha vira o redirect com a `?error=` que o front espera — e,
 * sem FRONTEND_URL, tudo continua sendo JSON (modo "API sem front" do
 * .env.example).
 *
 * A lógica de vínculo Conta/Membro segue coberta em
 * AuthenticateWithGoogleUseCase.test.ts.
 */
const MockedUseCase = AuthenticateWithGoogleUseCase as jest.MockedClass<
  typeof AuthenticateWithGoogleUseCase
>;

const FRONT = 'http://localhost:5173/auth/callback';

/** Perfil normalizado como o passport-google-oauth20 o entrega em req.user. */
function googleProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'google-sub-123',
    displayName: 'Ana Souza',
    emails: [{ value: 'ana@escacev.test' }],
    photos: [{ value: 'https://foto.test/ana.png' }],
    ...overrides,
  };
}

function fakeReq(user: unknown): Request {
  return { user } as unknown as Request;
}

/** Captura o que o controller fez: redirect(url) ou status().json(body). */
function fakeRes() {
  const state = { redirectedTo: null as string | null, status: 0, body: null as unknown };
  const res = {
    redirect: (url: string) => {
      state.redirectedTo = url;
    },
    status: (code: number) => {
      state.status = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, state };
}

describe('AuthController.googleCallback', () => {
  const controller = new AuthController();
  const prevFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = FRONT;
    MockedUseCase.prototype.execute = jest.fn().mockResolvedValue({ token: 'jwt-fake' });
  });

  afterAll(() => {
    process.env.FRONTEND_URL = prevFrontendUrl;
  });

  describe('com FRONTEND_URL (fluxo do navegador)', () => {
    it('sucesso: redireciona para o front com o token na query', async () => {
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(googleProfile()), res);

      expect(state.redirectedTo).toBe(`${FRONT}?token=jwt-fake`);
    });

    it('e-mail não convidado (403): redireciona com error=not_authorized', async () => {
      MockedUseCase.prototype.execute = jest
        .fn()
        .mockRejectedValue(
          new AppError('Usuário não autorizado — solicite um convite ao administrador', 403),
        );
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(googleProfile()), res);

      expect(state.redirectedTo).toBe(`${FRONT}?error=not_authorized`);
    });

    it('conta Google sem e-mail (400): redireciona com error=no_email', async () => {
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(googleProfile({ emails: [] })), res);

      expect(state.redirectedTo).toBe(`${FRONT}?error=no_email`);
    });

    it('sem perfil do Google (401): redireciona com error=auth_failed', async () => {
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(undefined), res);

      expect(state.redirectedTo).toBe(`${FRONT}?error=auth_failed`);
    });

    it('erro inesperado (não-AppError): cai no fallback error=api_error', async () => {
      MockedUseCase.prototype.execute = jest.fn().mockRejectedValue(new Error('banco caiu'));
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(googleProfile()), res);

      expect(state.redirectedTo).toBe(`${FRONT}?error=api_error`);
    });

    it('não vaza o token no redirect de erro', async () => {
      MockedUseCase.prototype.execute = jest
        .fn()
        .mockRejectedValue(new AppError('Usuário não autorizado', 403));
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(googleProfile()), res);

      expect(state.redirectedTo).not.toContain('token');
    });
  });

  describe('sem FRONTEND_URL (modo API sem front)', () => {
    beforeEach(() => {
      // String vazia é o default do .env.example — conta como ausente.
      process.env.FRONTEND_URL = '';
    });

    it('sucesso: devolve o token em JSON, sem redirecionar', async () => {
      const { res, state } = fakeRes();

      await controller.googleCallback(fakeReq(googleProfile()), res);

      expect(state.redirectedTo).toBeNull();
      expect(state.status).toBe(200);
      expect(state.body).toEqual({
        success: true,
        data: { token: 'jwt-fake' },
        message: 'Autenticação realizada com sucesso',
      });
    });

    it('erro: relança para o errorHandler responder JSON (comportamento antigo)', async () => {
      MockedUseCase.prototype.execute = jest
        .fn()
        .mockRejectedValue(new AppError('Usuário não autorizado', 403));
      const { res, state } = fakeRes();

      await expect(controller.googleCallback(fakeReq(googleProfile()), res)).rejects.toThrow(
        'Usuário não autorizado',
      );
      expect(state.redirectedTo).toBeNull();
    });
  });
});
