import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E das Funções (Position) dentro de um ministério. Foco em RBAC
 * escopado das escritas (ADMIN_MINISTERIO só onde tem isAdmin), leitura não
 * escopada, e o 409 de função em uso em alocações. Lógica nos unitários
 * (PositionUseCases.test.ts).
 */
const INST_ID = 'test-inst-pos';
const OTHER_INST_ID = 'test-inst-pos-other';
const ADMIN_GERAL_ID = 'test-pos-ag';
const ADMIN_SCOPED_ID = 'test-pos-scoped';
const ADMIN_UNSCOPED_ID = 'test-pos-unscoped';
const MEMBRO_ID = 'test-pos-membro';
const MINISTRY_ID = 'test-pos-min';
const FOREIGN_MINISTRY_ID = 'test-pos-min-foreign';

let adminGeralToken: string;
let adminScopedToken: string;
let adminUnscopedToken: string;
let membroToken: string;

async function cleanupFixtures() {
  await prisma.alocacao.deleteMany({ where: { membroId: MEMBRO_ID } });
  await prisma.escala.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.evento.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.funcao.deleteMany({ where: { ministerioId: { in: [MINISTRY_ID, FOREIGN_MINISTRY_ID] } } });
  await prisma.membroMinisterio.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.ministerio.deleteMany({ where: { id: { in: [MINISTRY_ID, FOREIGN_MINISTRY_ID] } } });
  await prisma.membro.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

async function newPosition(name: string): Promise<string> {
  const f = await prisma.funcao.create({ data: { ministerioId: MINISTRY_ID, nome: name } });
  return f.id;
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Funções' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Inst' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'AG', email: 'ag@test.pos', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_SCOPED_ID, instituicaoId: INST_ID, nome: 'AM Escopado', email: 'ams@test.pos', perfil: 'ADMIN_MINISTERIO' },
      { id: ADMIN_UNSCOPED_ID, instituicaoId: INST_ID, nome: 'AM Sem Escopo', email: 'amu@test.pos', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'MB', email: 'mb@test.pos', perfil: 'MEMBRO' },
    ],
  });
  await prisma.ministerio.create({ data: { id: MINISTRY_ID, instituicaoId: INST_ID, nome: 'Louvor' } });
  await prisma.ministerio.create({ data: { id: FOREIGN_MINISTRY_ID, instituicaoId: OTHER_INST_ID, nome: 'Alheio' } });
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

describe('POST /ministerios/:id/funcoes', () => {
  it('ADMIN_GERAL cria função (201)', async () => {
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Baterista' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Baterista');
  });

  it('ADMIN_MINISTERIO escopado cria função (201)', async () => {
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ name: 'Guitarrista' });
    expect(res.status).toBe(201);
  });

  it('ADMIN_MINISTERIO sem isAdmin no ministério recebe 403', async () => {
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send({ name: 'Baixista' });
    expect(res.status).toBe(403);
  });

  it('409 para nome de função duplicado no ministério', async () => {
    await newPosition('Tecladista');
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'TECLADISTA' });
    expect(res.status).toBe(409);
  });

  it('404 quando o ministério é de outra instituição', async () => {
    const res = await request(app)
      .post(`/ministerios/${FOREIGN_MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('MEMBRO não pode criar (403)', async () => {
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('GET /ministerios/:id/funcoes (leitura não escopada)', () => {
  it('ADMIN_MINISTERIO sem isAdmin ainda pode listar (200)', async () => {
    const res = await request(app)
      .get(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('MEMBRO não pode listar (403)', async () => {
    const res = await request(app)
      .get(`/ministerios/${MINISTRY_ID}/funcoes`)
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PUT /funcoes/:id', () => {
  it('ADMIN_GERAL renomeia (200)', async () => {
    const id = await newPosition('Vocal');
    const res = await request(app)
      .put(`/funcoes/${id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Backing Vocal' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Backing Vocal');
  });

  it('ADMIN_MINISTERIO sem isAdmin recebe 403', async () => {
    const id = await newPosition('Sax');
    const res = await request(app)
      .put(`/funcoes/${id}`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send({ name: 'Saxofonista' });
    expect(res.status).toBe(403);
  });

  it('409 ao renomear para nome já usado por outra função do ministério', async () => {
    await newPosition('Violino');
    const alvo = await newPosition('Viola');
    const res = await request(app)
      .put(`/funcoes/${alvo}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Violino' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /funcoes/:id', () => {
  it('ADMIN_GERAL remove função sem uso (200)', async () => {
    const id = await newPosition('Descartável');
    const res = await request(app)
      .delete(`/funcoes/${id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
    expect(await prisma.funcao.findUnique({ where: { id } })).toBeNull();
  });

  it('409 quando a função está em uso em uma alocação', async () => {
    const funcaoId = await newPosition('Em Uso');
    const evento = await prisma.evento.create({
      data: { id: 'test-pos-ev', instituicaoId: INST_ID, nome: 'Culto', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00Z'), fim: new Date('2026-07-12T20:00:00Z') },
    });
    const escala = await prisma.escala.create({
      data: { ministerioId: MINISTRY_ID, eventoId: evento.id },
    });
    await prisma.alocacao.create({
      data: { escalaId: escala.id, membroId: MEMBRO_ID, funcaoId },
    });

    const res = await request(app)
      .delete(`/funcoes/${funcaoId}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(409);
    expect(await prisma.funcao.findUnique({ where: { id: funcaoId } })).not.toBeNull();
  });

  it('ADMIN_MINISTERIO sem isAdmin recebe 403', async () => {
    const id = await newPosition('Protegida');
    const res = await request(app)
      .delete(`/funcoes/${id}`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`);
    expect(res.status).toBe(403);
  });
});

/**
 * GET /funcoes — catálogo de todas as funções da instituição, com o nome do
 * ministério. Insumo da tela de Funções e dos toggles de compatibilidade (que
 * mostram todas as funções, não só as do escopo do admin de grupo).
 */
describe('GET /funcoes (catálogo da instituição)', () => {
  it('ADMIN_GERAL lista todas as funções da instituição, com o nome do ministério', async () => {
    await newPosition('Vocal Catalogo');

    const res = await request(app)
      .get('/funcoes')
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((f: { name: string }) => f.name === 'Vocal Catalogo');
    expect(found).toMatchObject({ ministryId: MINISTRY_ID, ministryName: 'Louvor' });
  });

  it('ADMIN_MINISTERIO também lista o catálogo inteiro (não escopado — o par pode cruzar ministérios)', async () => {
    const res = await request(app)
      .get('/funcoes')
      .set('Authorization', `Bearer ${adminUnscopedToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('não vaza funções de outra instituição', async () => {
    await prisma.funcao.create({ data: { ministerioId: FOREIGN_MINISTRY_ID, nome: 'Alheia Catalogo' } });

    const res = await request(app)
      .get('/funcoes')
      .set('Authorization', `Bearer ${adminGeralToken}`);

    const names = res.body.data.map((f: { name: string }) => f.name);
    expect(names).not.toContain('Alheia Catalogo');
  });

  it('MEMBRO não acessa (403)', async () => {
    const res = await request(app)
      .get('/funcoes')
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });
});
