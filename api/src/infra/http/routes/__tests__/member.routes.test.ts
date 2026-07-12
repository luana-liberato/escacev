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
