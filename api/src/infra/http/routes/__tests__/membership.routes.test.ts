import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E do vínculo Membro↔Ministério (associar, convidar, promover,
 * remover, listar). Foco em RBAC escopado (ADMIN_MINISTERIO só age onde tem
 * isAdmin) + tenant + status. Lógica nos unitários (MembershipUseCases.test.ts).
 */
const INST_ID = 'test-inst-mship';
const ADMIN_GERAL_ID = 'test-mship-ag';
const ADMIN_SCOPED_ID = 'test-mship-scoped';
const ADMIN_UNSCOPED_ID = 'test-mship-unscoped';
const MEMBRO_ID = 'test-mship-membro';
const MINISTRY_ID = 'test-mship-min';

let adminGeralToken: string;
let adminScopedToken: string;
let adminUnscopedToken: string;
let membroToken: string;

async function cleanupFixtures() {
  await prisma.membroMinisterio.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.ministerio.deleteMany({ where: { id: MINISTRY_ID } });
  await prisma.membro.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.instituicao.deleteMany({ where: { id: INST_ID } });
}

/** Cria um membro-alvo novo (destino de associação/convite) e devolve o id. */
async function newMember(email: string): Promise<string> {
  const m = await prisma.membro.create({
    data: { instituicaoId: INST_ID, nome: 'Alvo', email, perfil: 'MEMBRO' },
  });
  return m.id;
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Vínculos' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'AG', email: 'ag@test.mship', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_SCOPED_ID, instituicaoId: INST_ID, nome: 'AM Escopado', email: 'ams@test.mship', perfil: 'ADMIN_MINISTERIO' },
      { id: ADMIN_UNSCOPED_ID, instituicaoId: INST_ID, nome: 'AM Sem Escopo', email: 'amu@test.mship', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'MB', email: 'mb@test.mship', perfil: 'MEMBRO' },
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

describe('POST /ministerios/:id/membros (associar)', () => {
  it('ADMIN_GERAL associa (201) com isAdmin', async () => {
    const memberId = await newMember('assoc1@test.mship');
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId, isAdmin: true });

    expect(res.status).toBe(201);
    expect(res.body.data.isAdmin).toBe(true);
  });

  it('ADMIN_MINISTERIO escopado associa (201)', async () => {
    const memberId = await newMember('assoc2@test.mship');
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ memberId });
    expect(res.status).toBe(201);
  });

  it('ADMIN_MINISTERIO sem isAdmin no ministério recebe 403', async () => {
    const memberId = await newMember('assoc3@test.mship');
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send({ memberId });
    expect(res.status).toBe(403);
  });

  it('409 para associação duplicada', async () => {
    const memberId = await newMember('assoc4@test.mship');
    const url = `/ministerios/${MINISTRY_ID}/membros`;
    await request(app).post(url).set('Authorization', `Bearer ${adminGeralToken}`).send({ memberId });
    const res = await request(app).post(url).set('Authorization', `Bearer ${adminGeralToken}`).send({ memberId });
    expect(res.status).toBe(409);
  });

  it('MEMBRO não pode associar (403)', async () => {
    const memberId = await newMember('assoc5@test.mship');
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ memberId });
    expect(res.status).toBe(403);
  });
});

describe('POST /ministerios/:id/membros/convite', () => {
  it('e-mail novo: cria e associa (201)', async () => {
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros/convite`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Convidada Nova', email: 'convite-novo@test.mship' });

    expect(res.status).toBe(201);
    expect(res.body.data.member.email).toBe('convite-novo@test.mship');
    expect(res.body.message).toContain('criado');
  });

  it('e-mail já no ministério: 409', async () => {
    const memberId = await newMember('convite-dup@test.mship');
    await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId });

    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros/convite`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Alvo', email: 'convite-dup@test.mship' });
    expect(res.status).toBe(409);
  });

  it('ADMIN_MINISTERIO escopado convida sempre com isAdmin=false (força false mesmo pedindo true)', async () => {
    const res = await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros/convite`)
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send({ name: 'Convidado AM', email: 'convite-am@test.mship', isAdmin: true });

    expect(res.status).toBe(201);
    expect(res.body.data.isAdmin).toBe(false);
  });
});

describe('PATCH /ministerios/:id/membros/:membroId/admin', () => {
  it('promove a admin do ministério (200, isAdmin=true)', async () => {
    const memberId = await newMember('promover@test.mship');
    await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId });

    const res = await request(app)
      .patch(`/ministerios/${MINISTRY_ID}/membros/${memberId}/admin`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ isAdmin: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isAdmin).toBe(true);
  });

  it('404 quando não há vínculo', async () => {
    const memberId = await newMember('sem-vinculo@test.mship');
    const res = await request(app)
      .patch(`/ministerios/${MINISTRY_ID}/membros/${memberId}/admin`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ isAdmin: true });
    expect(res.status).toBe(404);
  });

  it('400 quando isAdmin não é booleano', async () => {
    const memberId = await newMember('bool@test.mship');
    await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId });

    const res = await request(app)
      .patch(`/ministerios/${MINISTRY_ID}/membros/${memberId}/admin`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ isAdmin: 'sim' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /ministerios/:id/membros/:membroId', () => {
  it('remove o vínculo (200)', async () => {
    const memberId = await newMember('remover@test.mship');
    await request(app)
      .post(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId });

    const res = await request(app)
      .delete(`/ministerios/${MINISTRY_ID}/membros/${memberId}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
    const link = await prisma.membroMinisterio.findFirst({ where: { membroId: memberId, ministerioId: MINISTRY_ID } });
    expect(link).toBeNull();
  });

  it('404 quando não há vínculo para remover', async () => {
    const memberId = await newMember('nada@test.mship');
    const res = await request(app)
      .delete(`/ministerios/${MINISTRY_ID}/membros/${memberId}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Listagens do vínculo', () => {
  it('GET /ministerios/:id/membros lista com isAdmin (200)', async () => {
    const res = await request(app)
      .get(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.every((v: { isAdmin: unknown }) => typeof v.isAdmin === 'boolean')).toBe(true);
  });

  it('GET /membros/:id/ministerios lista os ministérios do membro (200)', async () => {
    const res = await request(app)
      .get(`/membros/${ADMIN_SCOPED_ID}/ministerios`)
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((v: { id: string }) => v.id === MINISTRY_ID)).toBe(true);
  });

  it('MEMBRO não pode listar membros do ministério (403)', async () => {
    const res = await request(app)
      .get(`/ministerios/${MINISTRY_ID}/membros`)
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });
});
