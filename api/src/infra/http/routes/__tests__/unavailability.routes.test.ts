import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Testes de integração/E2E dos endpoints de Indisponibilidade, contra o Postgres
 * real (Docker de dev). Cobre o fluxo member-scoped: o membro registra/lista/
 * remove só as próprias, e não remove as de outro membro (404). A lógica de
 * negócio já está coberta nos unitários (UnavailabilityUseCases.test.ts).
 *
 * Fixtures próprias, com ids prefixados "test-", isoladas do seed de dev e
 * limpas em afterAll.
 */
const INST_ID = 'test-inst-unavail';
const OTHER_INST_ID = 'test-inst-unavail-other';
const MEMBRO_ID = 'test-membro-unavail';
const OTHER_MEMBRO_ID = 'test-membro-unavail-other';
const ADMIN_ID = 'test-admin-unavail';
const OTHER_INST_MEMBRO_ID = 'test-membro-unavail-otherinst';

let membroToken: string;
let otherMembroToken: string;
let adminToken: string;

async function cleanupFixtures() {
  await prisma.indisponibilidade.deleteMany({
    where: { membroId: { in: [MEMBRO_ID, OTHER_MEMBRO_ID, ADMIN_ID, OTHER_INST_MEMBRO_ID] } },
  });
  await prisma.membro.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

beforeAll(async () => {
  await cleanupFixtures(); // defensivo: limpa resíduo de uma run anterior que falhou

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Instituição de Teste (Indisponibilidade)' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Instituição' } });
  await prisma.membro.createMany({
    data: [
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'Membro Teste', email: 'membro@test.escacev', perfil: 'MEMBRO' },
      { id: OTHER_MEMBRO_ID, instituicaoId: INST_ID, nome: 'Outro Membro', email: 'outro@test.escacev', perfil: 'MEMBRO' },
      { id: ADMIN_ID, instituicaoId: INST_ID, nome: 'Admin Geral', email: 'admin@test.escacev', perfil: 'ADMIN_GERAL' },
      { id: OTHER_INST_MEMBRO_ID, instituicaoId: OTHER_INST_ID, nome: 'Membro Alheio', email: 'alheio@test.escacev', perfil: 'MEMBRO' },
    ],
  });

  membroToken = signTestToken({ memberId: MEMBRO_ID, institutionId: INST_ID, role: 'MEMBRO' });
  otherMembroToken = signTestToken({ memberId: OTHER_MEMBRO_ID, institutionId: INST_ID, role: 'MEMBRO' });
  adminToken = signTestToken({ memberId: ADMIN_ID, institutionId: INST_ID, role: 'ADMIN_GERAL' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('POST /indisponibilidades', () => {
  it('MEMBRO registra a própria indisponibilidade (201)', async () => {
    const res = await request(app)
      .post('/indisponibilidades')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({
        startsAt: '2026-07-12T18:00:00.000Z',
        endsAt: '2026-07-12T22:00:00.000Z',
        reason: 'Viagem',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.memberId).toBe(MEMBRO_ID);
    expect(res.body.data.reason).toBe('Viagem');
  });

  it('registra sem motivo (reason null) (201)', async () => {
    const res = await request(app)
      .post('/indisponibilidades')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ startsAt: '2026-07-20T08:00:00.000Z', endsAt: '2026-07-20T12:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.data.reason).toBeNull();
  });

  it('rejeita endsAt <= startsAt (400)', async () => {
    const res = await request(app)
      .post('/indisponibilidades')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ startsAt: '2026-07-12T22:00:00.000Z', endsAt: '2026-07-12T18:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejeita data de início ausente (400)', async () => {
    const res = await request(app)
      .post('/indisponibilidades')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ endsAt: '2026-07-12T18:00:00.000Z' });

    expect(res.status).toBe(400);
  });

  it('sem token (401)', async () => {
    const res = await request(app)
      .post('/indisponibilidades')
      .send({ startsAt: '2026-07-12T18:00:00.000Z', endsAt: '2026-07-12T22:00:00.000Z' });

    expect(res.status).toBe(401);
  });
});

describe('GET /indisponibilidades/minhas', () => {
  it('lista só as do próprio membro (200)', async () => {
    const res = await request(app)
      .get('/indisponibilidades/minhas')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((u: { memberId: string }) => u.memberId === MEMBRO_ID)).toBe(true);
  });

  it('outro membro não vê as indisponibilidades alheias (200, lista vazia)', async () => {
    const res = await request(app)
      .get('/indisponibilidades/minhas')
      .set('Authorization', `Bearer ${otherMembroToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('sem token (401)', async () => {
    const res = await request(app).get('/indisponibilidades/minhas');
    expect(res.status).toBe(401);
  });
});

describe('GET /membros/:id/indisponibilidades (consulta do admin)', () => {
  it('ADMIN lista as indisponibilidades de um membro da sua instituição (200)', async () => {
    await prisma.indisponibilidade.create({
      data: { id: 'test-unavail-admin-view', membroId: OTHER_MEMBRO_ID, inicio: new Date('2026-09-01T10:00:00.000Z'), fim: new Date('2026-09-01T12:00:00.000Z') },
    });

    const res = await request(app)
      .get(`/membros/${OTHER_MEMBRO_ID}/indisponibilidades`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { id: string }) => u.id === 'test-unavail-admin-view')).toBe(true);
    expect(res.body.data.every((u: { memberId: string }) => u.memberId === OTHER_MEMBRO_ID)).toBe(true);
  });

  it('MEMBRO não pode consultar as de um membro (403)', async () => {
    const res = await request(app)
      .get(`/membros/${OTHER_MEMBRO_ID}/indisponibilidades`)
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });

  it('404 para membro de outra instituição (não vaza tenant)', async () => {
    const res = await request(app)
      .get(`/membros/${OTHER_INST_MEMBRO_ID}/indisponibilidades`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('404 para membro inexistente', async () => {
    const res = await request(app)
      .get('/membros/nao-existe/indisponibilidades')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('sem token (401)', async () => {
    const res = await request(app).get(`/membros/${OTHER_MEMBRO_ID}/indisponibilidades`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /indisponibilidades/:id', () => {
  it('MEMBRO remove a própria indisponibilidade (200)', async () => {
    const created = await prisma.indisponibilidade.create({
      data: { id: 'test-unavail-del-ok', membroId: MEMBRO_ID, inicio: new Date('2026-08-01T10:00:00.000Z'), fim: new Date('2026-08-01T12:00:00.000Z') },
    });

    const res = await request(app)
      .delete(`/indisponibilidades/${created.id}`)
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(200);
    expect(await prisma.indisponibilidade.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it('não remove a indisponibilidade de outro membro (404)', async () => {
    const created = await prisma.indisponibilidade.create({
      data: { id: 'test-unavail-del-foreign', membroId: MEMBRO_ID, inicio: new Date('2026-08-02T10:00:00.000Z'), fim: new Date('2026-08-02T12:00:00.000Z') },
    });

    const res = await request(app)
      .delete(`/indisponibilidades/${created.id}`)
      .set('Authorization', `Bearer ${otherMembroToken}`);

    expect(res.status).toBe(404);
    // não removeu: continua existindo
    expect(await prisma.indisponibilidade.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  it('404 quando a indisponibilidade não existe', async () => {
    const res = await request(app)
      .delete('/indisponibilidades/inexistente')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(404);
  });
});
