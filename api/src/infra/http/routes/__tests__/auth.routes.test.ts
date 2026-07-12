import request from 'supertest';
import { app } from '../../../../app';

/**
 * A rota de auth é o entrypoint do OAuth do Google. O callback não é testável de
 * ponta a ponta sem o Google real (o Passport troca um `code` válido por tokens),
 * então a lógica do callback — vínculo Conta/Membro, 403 sem convite, emissão do
 * JWT — é coberta no unit AuthenticateWithGoogleUseCase.test.ts. Aqui garantimos
 * o cabo do fluxo: GET /auth/google redireciona para a tela de consentimento.
 */
describe('GET /auth/google', () => {
  it('redireciona (302) para a tela de consentimento do Google', async () => {
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });
});
