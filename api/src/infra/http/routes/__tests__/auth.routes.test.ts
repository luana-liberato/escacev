import request from 'supertest';
import passport from 'passport';
import { app } from '../../../../app';
import { AuthenticateWithGoogleUseCase } from '../../../../domain/use-cases/auth/AuthenticateWithGoogleUseCase';

jest.mock('../../../../domain/use-cases/auth/AuthenticateWithGoogleUseCase');

/**
 * A rota de auth é o entrypoint do OAuth do Google. O callback não é testável de
 * ponta a ponta sem o Google real (o Passport troca um `code` válido por tokens),
 * então a lógica de vínculo Conta/Membro fica no unit
 * AuthenticateWithGoogleUseCase.test.ts e a tradução erro -> `?error=` no unit
 * AuthController.test.ts.
 *
 * Aqui provamos o que só existe na ROTA: (a) o redirect ao consentimento; (b) o
 * ENCANAMENTO do callback customizado — que o perfil do passport chega intacto ao
 * controller; e (c) a falha do PRÓPRIO PASSPORT, que acontece ANTES do controller
 * e por isso nenhum try/catch de lá alcança.
 *
 * O use case é mockado: o foco é o cabo, não a regra de negócio — e assim a rota
 * não depende do banco.
 */
const FRONT = 'http://localhost:5173/auth/callback';

const MockedUseCase = AuthenticateWithGoogleUseCase as jest.MockedClass<
  typeof AuthenticateWithGoogleUseCase
>;

/** Perfil como o passport-google-oauth20 o entrega. */
function googleProfile() {
  return {
    id: 'google-sub-rota',
    displayName: 'Ana Souza',
    emails: [{ value: 'ana@escacev.test' }],
    photos: [{ value: 'https://foto.test/ana.png' }],
  };
}

/**
 * Substitui o passport para exercitar cada desfecho do callback customizado sem
 * o Google real. O spy funciona mesmo com a rota já registrada porque
 * `authenticateGoogleCallback` chama `passport.authenticate` a cada request — não
 * na montagem.
 */
function mockPassport(err: unknown, profile: unknown) {
  return jest.spyOn(passport, 'authenticate').mockImplementation(((
    _strategy: string,
    _options: unknown,
    callback: (e: unknown, p: unknown) => void,
  ) => {
    return (_req: unknown, _res: unknown, _next: unknown) => callback(err, profile);
  }) as never);
}

describe('GET /auth/google', () => {
  it('redireciona (302) para a tela de consentimento do Google', async () => {
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });
});

describe('GET /auth/google/callback', () => {
  const prevFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = FRONT;
    MockedUseCase.prototype.execute = jest.fn().mockResolvedValue({ token: 'jwt-da-rota' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.FRONTEND_URL = prevFrontendUrl;
  });

  it('sucesso: o perfil do passport chega ao controller e o token volta na query', async () => {
    const execute = jest.fn().mockResolvedValue({ token: 'jwt-da-rota' });
    MockedUseCase.prototype.execute = execute;
    mockPassport(null, googleProfile());

    const res = await request(app).get('/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONT}?token=jwt-da-rota`);
    // Prova o encanamento: o `req.user = profile` do callback customizado
    // entregou o perfil intacto ao controller, que o normalizou.
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ googleSub: 'google-sub-rota', email: 'ana@escacev.test' }),
    );
  });

  it('usuário nega o consentimento (sem perfil): redireciona com error=auth_failed', async () => {
    mockPassport(null, false);

    const res = await request(app).get('/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONT}?error=auth_failed`);
  });

  it('erro do passport (Google fora do ar / rede): cai no fallback error=api_error', async () => {
    // Error comum, não AppError — não tem statusCode para mapear.
    mockPassport(new Error('conexão recusada ao trocar o code'), null);

    const res = await request(app).get('/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONT}?error=api_error`);
  });

  it('sem FRONTEND_URL: mantém o comportamento antigo (JSON do errorHandler)', async () => {
    process.env.FRONTEND_URL = '';
    mockPassport(null, false);

    const res = await request(app).get('/auth/google/callback');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      data: null,
      message: 'Falha na autenticação com o Google',
    });
  });
});
