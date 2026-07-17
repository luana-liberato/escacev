import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E dos endpoints de Membros contra o Postgres real (Docker de dev).
 * Foco em RBAC + tenant + status; a lógica de negócio já está nos unitários
 * (MemberUseCases.test.ts). Fixtures com ids "test-" isoladas do seed e limpas
 * em afterAll.
 */
const INST_ID = 'test-inst-members';
const OTHER_INST_ID = 'test-inst-members-other';
const ADMIN_GERAL_ID = 'test-mbr-admin-geral';
const ADMIN_MIN_ID = 'test-mbr-admin-ministerio';
const MEMBRO_ID = 'test-mbr-membro';
const OTHER_MEMBER_ID = 'test-mbr-outro-tenant';

let adminGeralToken: string;
let adminMinToken: string;
let membroToken: string;

async function cleanupFixtures() {
  await prisma.membro.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Instituição de Teste (Membros)' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Instituição' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'Admin Geral', email: 'ag@test.members', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_MIN_ID, instituicaoId: INST_ID, nome: 'Admin Ministério', email: 'am@test.members', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'Membro', email: 'mb@test.members', perfil: 'MEMBRO' },
      { id: OTHER_MEMBER_ID, instituicaoId: OTHER_INST_ID, nome: 'De Outro Tenant', email: 'outro@test.members', perfil: 'MEMBRO' },
    ],
  });

  adminGeralToken = signTestToken({ memberId: ADMIN_GERAL_ID, institutionId: INST_ID, role: 'ADMIN_GERAL' });
  adminMinToken = signTestToken({ memberId: ADMIN_MIN_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
  membroToken = signTestToken({ memberId: MEMBRO_ID, institutionId: INST_ID, role: 'MEMBRO' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('POST /membros', () => {
  it('ADMIN_GERAL convida membro (201)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Novo Membro', email: 'novo@test.members', role: 'MEMBRO' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pending).toBe(true); // nasce sem Account
  });

  it('ADMIN_MINISTERIO também pode convidar (201)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', `Bearer ${adminMinToken}`)
      .send({ name: 'Convidado', email: 'convidado@test.members' });

    expect(res.status).toBe(201);
  });

  it('rejeita e-mail duplicado na instituição (409)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Repetido', email: 'ag@test.members' }); // e-mail do admin geral

    expect(res.status).toBe(409);
  });

  it('rejeita e-mail inválido (400)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'X', email: 'nao-e-email' });

    expect(res.status).toBe(400);
  });

  it('rejeita perfil fora do enum (400)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'X', email: 'perfil@test.members', role: 'SUPER_ADMIN' });

    expect(res.status).toBe(400);
  });

  it('MEMBRO não pode convidar (403)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: 'X', email: 'intruso@test.members' });

    expect(res.status).toBe(403);
  });

  it('sem token (401)', async () => {
    const res = await request(app).post('/membros').send({ name: 'X', email: 'x@test.members' });
    expect(res.status).toBe(401);
  });

  it('token inválido (401)', async () => {
    const res = await request(app)
      .post('/membros')
      .set('Authorization', 'Bearer token-invalido')
      .send({ name: 'X', email: 'x@test.members' });
    expect(res.status).toBe(401);
  });
});

describe('GET /membros', () => {
  it('ADMIN_GERAL lista só a própria instituição (200)', async () => {
    const res = await request(app).get('/membros').set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((m: { email: string }) => m.email.endsWith('test.members'))).toBe(true);
    expect(res.body.data.some((m: { id: string }) => m.id === OTHER_MEMBER_ID)).toBe(false);
  });

  it('MEMBRO não pode listar (403)', async () => {
    const res = await request(app).get('/membros').set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /membros/me', () => {
  /**
   * A razão de existir da rota: o JWT carrega só { memberId, institutionId,
   * role } e o GET /membros/:id exige admin — sem esta rota, um MEMBRO não
   * conseguiria ler o próprio nome.
   *
   * Este teste também prova a ORDEM de registro: se '/membros/:id' viesse antes,
   * ele capturaria "me" e o rbac responderia 403 aqui.
   */
  it('MEMBRO lê os próprios dados (200) — o que /membros/:id nega a ele', async () => {
    const res = await request(app)
      .get('/membros/me')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: MEMBRO_ID,
      name: 'Membro',
      email: 'mb@test.members',
      role: 'MEMBRO',
      active: true,
    });
  });

  it('o MEMBRO continua sem poder ler o cadastro alheio por /membros/:id (403)', async () => {
    const res = await request(app)
      .get(`/membros/${ADMIN_GERAL_ID}`)
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(403);
  });

  it('ADMIN_GERAL também lê os próprios dados (200)', async () => {
    const res = await request(app)
      .get('/membros/me')
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ADMIN_GERAL_ID);
    expect(res.body.data.role).toBe('ADMIN_GERAL');
  });

  it('não vaza accountId nem institutionId (projeção pública)', async () => {
    const res = await request(app)
      .get('/membros/me')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.body.data).not.toHaveProperty('accountId');
    expect(res.body.data).not.toHaveProperty('institutionId');
    expect(res.body.data).toHaveProperty('pending');
  });

  it('sem token (401)', async () => {
    const res = await request(app).get('/membros/me');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /membros/me', () => {
  /** Devolve o membro ao nome original — os outros testes dependem dele. */
  async function restoreName(id: string, nome: string) {
    await prisma.membro.update({ where: { id }, data: { nome } });
  }

  it('MEMBRO corrige o próprio nome (200)', async () => {
    const res = await request(app)
      .patch('/membros/me')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: 'Membro Corrigido' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Membro Corrigido');

    const row = await prisma.membro.findUnique({ where: { id: MEMBRO_ID } });
    expect(row?.nome).toBe('Membro Corrigido');

    await restoreName(MEMBRO_ID, 'Membro');
  });

  /**
   * O teste que justifica o use case dedicado: o alvo é sempre o PRÓPRIO
   * usuário, então aceitar `role` aqui seria escalada de privilégio. O
   * UpdateMyNameUseCase não tem onde receber perfil — isto trava a fronteira.
   */
  it('MEMBRO não se promove mandando role no corpo (perfil intacto)', async () => {
    const res = await request(app)
      .patch('/membros/me')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: 'Tentativa', role: 'ADMIN_GERAL', active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('MEMBRO');
    expect(res.body.data.active).toBe(true);

    const row = await prisma.membro.findUnique({ where: { id: MEMBRO_ID } });
    expect(row?.perfil).toBe('MEMBRO');
    expect(row?.ativo).toBe(true);

    await restoreName(MEMBRO_ID, 'Membro');
  });

  it('ADMIN_GERAL também corrige o próprio nome (200)', async () => {
    const res = await request(app)
      .patch('/membros/me')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Admin Renomeado' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Admin Renomeado');

    await restoreName(ADMIN_GERAL_ID, 'Admin Geral');
  });

  it('rejeita nome vazio (400) — a validação é da entidade', async () => {
    const res = await request(app)
      .patch('/membros/me')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);

    const row = await prisma.membro.findUnique({ where: { id: MEMBRO_ID } });
    expect(row?.nome).toBe('Membro');
  });

  it('sem token (401)', async () => {
    const res = await request(app).patch('/membros/me').send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});

describe('GET /membros/:id', () => {
  it('404 para membro de outra instituição (não vaza outro tenant)', async () => {
    const res = await request(app)
      .get(`/membros/${OTHER_MEMBER_ID}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /membros/:id', () => {
  it('ADMIN_GERAL atualiza (200)', async () => {
    const res = await request(app)
      .put(`/membros/${MEMBRO_ID}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Membro Renomeado' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Membro Renomeado');
  });

  it('ADMIN_MINISTERIO não pode atualizar (403 — update é exclusivo do ADMIN_GERAL)', async () => {
    const res = await request(app)
      .put(`/membros/${MEMBRO_ID}`)
      .set('Authorization', `Bearer ${adminMinToken}`)
      .send({ name: 'Tentativa' });

    expect(res.status).toBe(403);
  });

  it('404 ao atualizar membro inexistente', async () => {
    const res = await request(app)
      .put('/membros/nao-existe')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Ninguém' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /membros/:id', () => {
  it('ADMIN_GERAL desativa (soft delete): active vira false (200)', async () => {
    const target = await prisma.membro.create({
      data: { id: 'test-mbr-desativar', instituicaoId: INST_ID, nome: 'Para Desativar', email: 'desativar@test.members', perfil: 'MEMBRO' },
    });

    const res = await request(app)
      .delete(`/membros/${target.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
    const row = await prisma.membro.findUnique({ where: { id: target.id } });
    expect(row?.ativo).toBe(false); // não removeu fisicamente
  });

  it('MEMBRO não pode desativar (403)', async () => {
    const res = await request(app)
      .delete(`/membros/${ADMIN_MIN_ID}`)
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });
});

/**
 * O perfil e o status vêm do BANCO a cada request, não do JWT. Estes testes
 * travam a razão da mudança: sem eles, promover não promovia e desativar não
 * desativava — os dois só valeriam no próximo login, até 7 dias depois.
 */
describe('auth — perfil e status vêm do banco, não do token', () => {
  afterEach(async () => {
    // Devolve o membro ao estado das fixtures.
    await prisma.membro.update({
      where: { id: MEMBRO_ID },
      data: { perfil: 'MEMBRO', ativo: true },
    });
  });

  it('promover vale IMEDIATAMENTE, sem token novo', async () => {
    // Token antigo, emitido quando ele ainda era MEMBRO.
    const tokenAntigo = membroToken;

    const antes = await request(app).get('/membros').set('Authorization', `Bearer ${tokenAntigo}`);
    expect(antes.status).toBe(403); // MEMBRO não lista

    await prisma.membro.update({ where: { id: MEMBRO_ID }, data: { perfil: 'ADMIN_GERAL' } });

    const depois = await request(app).get('/membros').set('Authorization', `Bearer ${tokenAntigo}`);
    expect(depois.status).toBe(200); // mesmo token, novo poder
  });

  it('rebaixar vale IMEDIATAMENTE: o perfil do token é ignorado', async () => {
    // Token FORJADO dizendo ADMIN_GERAL para quem é MEMBRO no banco.
    const tokenMentiroso = signTestToken({
      memberId: MEMBRO_ID,
      institutionId: INST_ID,
      role: 'ADMIN_GERAL',
    });

    const res = await request(app).get('/membros').set('Authorization', `Bearer ${tokenMentiroso}`);

    expect(res.status).toBe(403); // o banco manda: ele é MEMBRO
  });

  /** O caso grave: antes, desligar alguém não desligava por até 7 dias. */
  it('membro desativado perde o acesso na hora (401)', async () => {
    await prisma.membro.update({ where: { id: MEMBRO_ID }, data: { ativo: false } });

    const res = await request(app)
      .get('/membros/me')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('desativado');
  });

  it('token válido de membro que não existe mais: 401', async () => {
    const token = signTestToken({
      memberId: 'test-mbr-inexistente',
      institutionId: INST_ID,
      role: 'ADMIN_GERAL',
    });

    const res = await request(app).get('/membros').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
