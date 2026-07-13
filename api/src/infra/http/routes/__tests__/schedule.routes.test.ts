import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E das Escalas (casca, sem alocações). Foco em RBAC escopado
 * (ADMIN_MINISTERIO só cria/remove onde tem isAdmin) + tenant + status. Lógica de
 * negócio nos unitários (ScheduleUseCases.test.ts). Fixtures "test-" limpas em afterAll.
 */
const INST_ID = 'test-inst-sched';
const OTHER_INST_ID = 'test-inst-sched-other';
const ADMIN_GERAL_ID = 'test-sched-ag';
const ADMIN_SCOPED_ID = 'test-sched-scoped';
const ADMIN_UNSCOPED_ID = 'test-sched-unscoped';
const MEMBRO_ID = 'test-sched-membro';
const MINISTRY_ID = 'test-sched-min';

let adminGeralToken: string;
let adminScopedToken: string;
let adminUnscopedToken: string;
let membroToken: string;
let eventSeq = 0;

async function cleanupFixtures() {
  await prisma.escala.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.evento.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.membroMinisterio.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.ministerio.deleteMany({ where: { id: MINISTRY_ID } });
  await prisma.membro.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

/** Cria um evento novo (id único) para cada teste, evitando colisão do @@unique. */
async function newEvent(institutionId = INST_ID): Promise<string> {
  const id = `test-sched-ev-${eventSeq++}`;
  await prisma.evento.create({
    data: { id, instituicaoId: institutionId, nome: 'Culto', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00Z'), fim: new Date('2026-07-12T20:00:00Z') },
  });
  return id;
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Escalas' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Inst' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'AG', email: 'ag@test.sched', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_SCOPED_ID, instituicaoId: INST_ID, nome: 'AM Escopado', email: 'ams@test.sched', perfil: 'ADMIN_MINISTERIO' },
      { id: ADMIN_UNSCOPED_ID, instituicaoId: INST_ID, nome: 'AM Sem Escopo', email: 'amu@test.sched', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'MB', email: 'mb@test.sched', perfil: 'MEMBRO' },
    ],
  });
  await prisma.ministerio.create({ data: { id: MINISTRY_ID, instituicaoId: INST_ID, nome: 'Louvor' } });
  await prisma.membroMinisterio.create({
    data: { membroId: ADMIN_SCOPED_ID, ministerioId: MINISTRY_ID, isAdmin: true },
  });

  adminGeralToken = signTestToken({ memberId: ADMIN_GERAL_ID, institutionId: INST_ID, role: 'ADMIN_GERAL' });
  adminScopedToken = signTestToken({ memberId: ADMIN_SCOPED_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
  adminUnscopedToken = signTestToken({ memberId: ADMIN_UNSCOPED_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
  membroToken = signTestToken({ memberId: MEMBRO_ID, institutionId: INST_ID, role: 'MEMBRO' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('POST /escalas', () => {
  it('ADMIN_MINISTERIO com isAdmin no ministério cria a escala (201, RASCUNHO)', async () => {
    const eventId = await newEvent();
    const res = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ ministryId: MINISTRY_ID, eventId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RASCUNHO');
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('ADMIN_MINISTERIO SEM isAdmin naquele ministério recebe 403', async () => {
    const eventId = await newEvent();
    const res = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send({ ministryId: MINISTRY_ID, eventId });

    expect(res.status).toBe(403);
  });

  it('ADMIN_GERAL cria a escala (201)', async () => {
    const eventId = await newEvent();
    const res = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ ministryId: MINISTRY_ID, eventId });

    expect(res.status).toBe(201);
  });

  it('409 para duplicata da escala padrão (mesmo ministério + evento, sem nome)', async () => {
    const eventId = await newEvent();
    const url = '/escalas';
    await request(app).post(url).set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });
    const res = await request(app).post(url).set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });

    expect(res.status).toBe(409);
  });

  it('cria várias escalas NOMEADAS (salas) para o mesmo ministério+evento (201) e 409 no nome repetido', async () => {
    const eventId = await newEvent();
    const url = '/escalas';
    const post = (name: string) =>
      request(app).post(url).set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId, name });

    const bercario = await post('Berçário');
    const sala1 = await post('Sala 1');
    expect(bercario.status).toBe(201);
    expect(bercario.body.data.name).toBe('Berçário');
    expect(sala1.status).toBe(201);

    // repetir "Sala 1" no mesmo ministério+evento colide
    const dup = await post('Sala 1');
    expect(dup.status).toBe(409);
  });

  it('409 para nome duplicado com caixa diferente ("6 e 7" vs "6 E 7")', async () => {
    const eventId = await newEvent();
    const post = (name: string) =>
      request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId, name });

    expect((await post('6 e 7')).status).toBe(201);
    expect((await post('6 E 7')).status).toBe(409);
  });

  it('MEMBRO não pode criar (403)', async () => {
    const eventId = await newEvent();
    const res = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ ministryId: MINISTRY_ID, eventId });
    expect(res.status).toBe(403);
  });

  it('sem token (401)', async () => {
    const eventId = await newEvent();
    const res = await request(app).post('/escalas').send({ ministryId: MINISTRY_ID, eventId });
    expect(res.status).toBe(401);
  });
});

describe('GET /escalas e /escalas/:id', () => {
  it('lista por evento retorna a escala daquele evento (200)', async () => {
    const eventId = await newEvent();
    await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });

    const res = await request(app)
      .get('/escalas')
      .query({ eventId })
      .set('Authorization', `Bearer ${adminScopedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].eventId).toBe(eventId);
  });

  it('ver por id (200) e 404 para inexistente', async () => {
    const eventId = await newEvent();
    const created = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });

    const ok = await request(app).get(`/escalas/${created.body.data.id}`).set('Authorization', `Bearer ${adminGeralToken}`);
    expect(ok.status).toBe(200);

    const notFound = await request(app).get('/escalas/nao-existe').set('Authorization', `Bearer ${adminGeralToken}`);
    expect(notFound.status).toBe(404);
  });

  it('MEMBRO não pode listar (403)', async () => {
    const res = await request(app).get('/escalas').set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /escalas/:id', () => {
  it('admin escopado remove (200); admin sem escopo recebe 403', async () => {
    const eventId = await newEvent();
    const created = await request(app).post('/escalas').set('Authorization', `Bearer ${adminScopedToken}`).send({ ministryId: MINISTRY_ID, eventId });
    const scheduleId = created.body.data.id;

    const forbidden = await request(app).delete(`/escalas/${scheduleId}`).set('Authorization', `Bearer ${adminUnscopedToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app).delete(`/escalas/${scheduleId}`).set('Authorization', `Bearer ${adminScopedToken}`);
    expect(ok.status).toBe(200);
    expect(await prisma.escala.findUnique({ where: { id: scheduleId } })).toBeNull();
  });
});
