import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E dos endpoints de Ministérios. Foco em RBAC + tenant + a
 * PERMISSÃO ESCOPADA do PUT (ADMIN_MINISTERIO só edita onde tem isAdmin) — o que
 * os .http não conseguem exercitar bem. Lógica de negócio nos unitários
 * (MinistryUseCases.test.ts). Fixtures "test-" limpas em afterAll.
 */
const INST_ID = 'test-inst-ministries';
const OTHER_INST_ID = 'test-inst-ministries-other';
const ADMIN_GERAL_ID = 'test-min-admin-geral';
const ADMIN_SCOPED_ID = 'test-min-admin-scoped'; // isAdmin no SCOPED_MINISTRY
const ADMIN_UNSCOPED_ID = 'test-min-admin-unscoped'; // ADMIN_MINISTERIO sem isAdmin
const MEMBRO_ID = 'test-min-membro';
const SCOPED_MINISTRY_ID = 'test-min-scoped';
const OTHER_MINISTRY_ID = 'test-min-other';
const FOREIGN_MINISTRY_ID = 'test-min-foreign';

let adminGeralToken: string;
let adminScopedToken: string;
let adminUnscopedToken: string;
let membroToken: string;

async function cleanupFixtures() {
  await prisma.escala.deleteMany({
    where: { ministerioId: { in: [SCOPED_MINISTRY_ID, OTHER_MINISTRY_ID] } },
  });
  await prisma.evento.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.membroMinisterio.deleteMany({
    where: { ministerioId: { in: [SCOPED_MINISTRY_ID, OTHER_MINISTRY_ID, FOREIGN_MINISTRY_ID] } },
  });
  await prisma.ministerio.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.membro.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Ministérios' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Inst' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'AG', email: 'ag@test.min', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_SCOPED_ID, instituicaoId: INST_ID, nome: 'AM Escopado', email: 'ams@test.min', perfil: 'ADMIN_MINISTERIO' },
      { id: ADMIN_UNSCOPED_ID, instituicaoId: INST_ID, nome: 'AM Sem Escopo', email: 'amu@test.min', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'MB', email: 'mb@test.min', perfil: 'MEMBRO' },
    ],
  });
  await prisma.ministerio.createMany({
    data: [
      { id: SCOPED_MINISTRY_ID, instituicaoId: INST_ID, nome: 'Louvor' },
      { id: OTHER_MINISTRY_ID, instituicaoId: INST_ID, nome: 'Recepção' },
      { id: FOREIGN_MINISTRY_ID, instituicaoId: OTHER_INST_ID, nome: 'Mídia Alheia' },
    ],
  });
  // ADMIN_SCOPED administra apenas o SCOPED_MINISTRY.
  await prisma.membroMinisterio.create({
    data: { membroId: ADMIN_SCOPED_ID, ministerioId: SCOPED_MINISTRY_ID, isAdmin: true },
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

describe('POST /ministerios', () => {
  it('ADMIN_GERAL cria (201)', async () => {
    const res = await request(app)
      .post('/ministerios')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Novo Ministério', description: 'Desc' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Novo Ministério');
  });

  it('409 para nome duplicado (case-insensitive)', async () => {
    const res = await request(app)
      .post('/ministerios')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'LOUVOR' });
    expect(res.status).toBe(409);
  });

  it('400 para nome vazio', async () => {
    const res = await request(app)
      .post('/ministerios')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('ADMIN_MINISTERIO não pode criar (403 — escopo de instituição)', async () => {
    const res = await request(app)
      .post('/ministerios')
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ name: 'Intruso' });
    expect(res.status).toBe(403);
  });

  it('sem token (401)', async () => {
    const res = await request(app).post('/ministerios').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /ministerios', () => {
  it('ADMIN_MINISTERIO pode listar (200)', async () => {
    const res = await request(app).get('/ministerios').set('Authorization', `Bearer ${adminScopedToken}`);
    expect(res.status).toBe(200);
  });

  it('MEMBRO não pode listar (403)', async () => {
    const res = await request(app).get('/ministerios').set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /:id — 404 para ministério de outra instituição', async () => {
    const res = await request(app)
      .get(`/ministerios/${FOREIGN_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /ministerios/:id (permissão escopada)', () => {
  it('ADMIN_GERAL edita qualquer ministério (200)', async () => {
    const res = await request(app)
      .put(`/ministerios/${OTHER_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ description: 'Editado pelo geral' });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Editado pelo geral');
  });

  it('ADMIN_MINISTERIO com isAdmin naquele ministério edita (200)', async () => {
    const res = await request(app)
      .put(`/ministerios/${SCOPED_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ description: 'Editado pelo admin escopado' });
    expect(res.status).toBe(200);
  });

  it('ADMIN_MINISTERIO sem isAdmin naquele ministério recebe 403', async () => {
    const res = await request(app)
      .put(`/ministerios/${SCOPED_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send({ description: 'Tentativa' });
    expect(res.status).toBe(403);
  });

  it('ADMIN_MINISTERIO escopado num ministério NÃO edita outro (403)', async () => {
    const res = await request(app)
      .put(`/ministerios/${OTHER_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ description: 'Fora do escopo' });
    expect(res.status).toBe(403);
  });

  it('MEMBRO recebe 403 (bloqueado no rbac grosso)', async () => {
    const res = await request(app)
      .put(`/ministerios/${SCOPED_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ description: 'X' });
    expect(res.status).toBe(403);
  });

  it('409 ao renomear para nome já usado por outro ministério', async () => {
    const res = await request(app)
      .put(`/ministerios/${SCOPED_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Recepção' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /ministerios/:id', () => {
  it('ADMIN_MINISTERIO não pode remover (403 — remoção é do ADMIN_GERAL)', async () => {
    const res = await request(app)
      .delete(`/ministerios/${SCOPED_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminScopedToken}`);
    expect(res.status).toBe(403);
  });

  it('ADMIN_GERAL remove ministério sem dependências (200)', async () => {
    const m = await prisma.ministerio.create({
      data: { id: 'test-min-delete-ok', instituicaoId: INST_ID, nome: 'Descartável' },
    });
    const res = await request(app)
      .delete(`/ministerios/${m.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
    expect(await prisma.ministerio.findUnique({ where: { id: m.id } })).toBeNull();
  });

  it('ADMIN_GERAL não remove ministério com escala vinculada (409)', async () => {
    const evento = await prisma.evento.create({
      data: { id: 'test-min-ev', instituicaoId: INST_ID, nome: 'Culto', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00Z'), fim: new Date('2026-07-12T20:00:00Z') },
    });
    await prisma.escala.create({
      data: { id: 'test-min-escala', ministerioId: OTHER_MINISTRY_ID, eventoId: evento.id },
    });

    const res = await request(app)
      .delete(`/ministerios/${OTHER_MINISTRY_ID}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('escalas');
  });
});

/**
 * GET /ministerios/cards — o read model da tela, escopado por papel. A razão de
 * existir: o MEMBRO precisa VER a tela, e todo o resto de /ministerios é
 * admin-only. Estes testes travam o escopo por ator e o enriquecimento (admins +
 * "você administra").
 */
describe('GET /ministerios/cards', () => {
  afterEach(async () => {
    // Remove vínculos que os testes deste bloco criam para o MEMBRO.
    await prisma.membroMinisterio.deleteMany({ where: { membroId: MEMBRO_ID } });
  });

  it('MEMBRO enxerga a tela (200, não 403) — o que /ministerios nega a ele', async () => {
    const res = await request(app)
      .get('/ministerios/cards')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('MEMBRO vê só os ministérios de que participa, com quem administra', async () => {
    await prisma.membroMinisterio.create({
      data: { membroId: MEMBRO_ID, ministerioId: SCOPED_MINISTRY_ID, isAdmin: false },
    });

    const res = await request(app)
      .get('/ministerios/cards')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.body.data).toHaveLength(1);
    const card = res.body.data[0];
    expect(card.id).toBe(SCOPED_MINISTRY_ID);
    expect(card.isCurrentUserAdmin).toBe(false); // participa, não administra
    // ADMIN_SCOPED é admin do Louvor (fixture) — aparece na linha de administradores.
    expect(card.admins.map((a: { id: string }) => a.id)).toContain(ADMIN_SCOPED_ID);
  });

  it('ADMIN_GERAL vê TODOS os ministérios da instituição', async () => {
    const res = await request(app)
      .get('/ministerios/cards')
      .set('Authorization', `Bearer ${adminGeralToken}`);

    const ids = res.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(SCOPED_MINISTRY_ID);
    expect(ids).toContain(OTHER_MINISTRY_ID);
    expect(ids).not.toContain(FOREIGN_MINISTRY_ID); // outro tenant, nunca
  });

  it('ADMIN_MINISTERIO vê só os que participa; o que administra vem com o badge', async () => {
    const res = await request(app)
      .get('/ministerios/cards')
      .set('Authorization', `Bearer ${adminScopedToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(SCOPED_MINISTRY_ID);
    expect(res.body.data[0].isCurrentUserAdmin).toBe(true);
  });

  it('sem token (401)', async () => {
    const res = await request(app).get('/ministerios/cards');
    expect(res.status).toBe(401);
  });

  it('a rota vem antes de /ministerios/:id — "cards" não é tratado como id', async () => {
    // Se o :id capturasse "cards", um ADMIN daria 404 (ministério inexistente).
    const res = await request(app)
      .get('/ministerios/cards')
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
  });
});
