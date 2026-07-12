import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E da matriz de compatibilidade entre funções. Escrita E leitura
 * são de escopo de INSTITUIÇÃO — restritas ao ADMIN_GERAL (sem guarda escopada).
 * Lógica nos unitários (PositionCompatibilityUseCases.test.ts).
 */
const INST_ID = 'test-inst-compat';
const OTHER_INST_ID = 'test-inst-compat-other';
const ADMIN_GERAL_ID = 'test-compat-ag';
const ADMIN_MIN_ID = 'test-compat-am';
const MINISTRY_A = 'test-compat-min-a';
const MINISTRY_B = 'test-compat-min-b';
const FOREIGN_MINISTRY = 'test-compat-min-foreign';

let adminGeralToken: string;
let adminMinToken: string;
let posA: string;
let posB: string;
let foreignPos: string;

async function cleanupFixtures() {
  const ministries = [MINISTRY_A, MINISTRY_B, FOREIGN_MINISTRY];
  const funcs = await prisma.funcao.findMany({ where: { ministerioId: { in: ministries } }, select: { id: true } });
  const ids = funcs.map((f) => f.id);
  if (ids.length) {
    await prisma.compatibilidadeFuncao.deleteMany({
      where: { OR: [{ funcaoAId: { in: ids } }, { funcaoBId: { in: ids } }] },
    });
  }
  await prisma.funcao.deleteMany({ where: { ministerioId: { in: ministries } } });
  await prisma.ministerio.deleteMany({ where: { id: { in: ministries } } });
  await prisma.membro.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Compat' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Inst' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'AG', email: 'ag@test.compat', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_MIN_ID, instituicaoId: INST_ID, nome: 'AM', email: 'am@test.compat', perfil: 'ADMIN_MINISTERIO' },
    ],
  });
  // Duas funções em ministérios diferentes da MESMA instituição — a matriz pode
  // ligar funções de ministérios distintos (por isso é escopo de instituição).
  await prisma.ministerio.create({ data: { id: MINISTRY_A, instituicaoId: INST_ID, nome: 'Louvor' } });
  await prisma.ministerio.create({ data: { id: MINISTRY_B, instituicaoId: INST_ID, nome: 'Mídia' } });
  await prisma.ministerio.create({ data: { id: FOREIGN_MINISTRY, instituicaoId: OTHER_INST_ID, nome: 'Alheio' } });
  posA = (await prisma.funcao.create({ data: { ministerioId: MINISTRY_A, nome: 'Vocal' } })).id;
  posB = (await prisma.funcao.create({ data: { ministerioId: MINISTRY_B, nome: 'Câmera' } })).id;
  foreignPos = (await prisma.funcao.create({ data: { ministerioId: FOREIGN_MINISTRY, nome: 'X' } })).id;

  adminGeralToken = signTestToken({ memberId: ADMIN_GERAL_ID, institutionId: INST_ID, role: 'ADMIN_GERAL' });
  adminMinToken = signTestToken({ memberId: ADMIN_MIN_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('POST /funcoes/compatibilidade', () => {
  it('ADMIN_GERAL marca par como compatível (201)', async () => {
    const res = await request(app)
      .post('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ positionAId: posA, positionBId: posB });
    expect(res.status).toBe(201);
    // forma canônica: A < B
    expect(res.body.data.positionAId < res.body.data.positionBId).toBe(true);
  });

  it('idempotente: remarcar (invertendo a ordem) não duplica (201, mesmo id)', async () => {
    const first = await prisma.compatibilidadeFuncao.findFirst();
    const res = await request(app)
      .post('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ positionAId: posB, positionBId: posA });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(first?.id);
    expect(await prisma.compatibilidadeFuncao.count()).toBe(1);
  });

  it('400 ao marcar função consigo mesma', async () => {
    const res = await request(app)
      .post('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ positionAId: posA, positionBId: posA });
    expect(res.status).toBe(400);
  });

  it('404 quando uma função é de outra instituição', async () => {
    const res = await request(app)
      .post('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ positionAId: posA, positionBId: foreignPos });
    expect(res.status).toBe(404);
  });

  it('ADMIN_MINISTERIO não pode definir a matriz (403)', async () => {
    const res = await request(app)
      .post('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminMinToken}`)
      .send({ positionAId: posA, positionBId: posB });
    expect(res.status).toBe(403);
  });
});

describe('GET /funcoes/compatibilidade', () => {
  it('ADMIN_GERAL lista os pares (200)', async () => {
    const res = await request(app)
      .get('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('ADMIN_MINISTERIO não pode listar (403)', async () => {
    const res = await request(app)
      .get('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminMinToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /funcoes/compatibilidade', () => {
  it('400 quando faltam os ids na query', async () => {
    const res = await request(app)
      .delete('/funcoes/compatibilidade')
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(400);
  });

  it('ADMIN_GERAL remove o par (200) e é idempotente ao repetir', async () => {
    const first = await request(app)
      .delete('/funcoes/compatibilidade')
      .query({ positionAId: posA, positionBId: posB })
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(first.status).toBe(200);
    expect(await prisma.compatibilidadeFuncao.count()).toBe(0);

    // repetir com o par já ausente (funções válidas) continua 200 (idempotente)
    const again = await request(app)
      .delete('/funcoes/compatibilidade')
      .query({ positionAId: posA, positionBId: posB })
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(again.status).toBe(200);
  });

  it('404 quando uma função da query é inválida/de outro tenant', async () => {
    const res = await request(app)
      .delete('/funcoes/compatibilidade')
      .query({ positionAId: posA, positionBId: foreignPos })
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
  });
});
