import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E das Alocações — foco na FIAÇÃO HTTP (rotas plugadas nos use
 * cases certos) e no RBAC de rota (admin escopado vs. sem isAdmin no ministério
 * da escala). A lógica de negócio (validação de pertencimento, 409 de duplicata,
 * lote parcial, etc.) já está coberta nos unitários dos incrementos 1 e 2
 * (AddAssignmentsUseCase.test.ts, UpdateAssignmentUseCase.test.ts,
 * RemoveAssignmentUseCase.test.ts) — não é re-testada aqui.
 */
const INST_ID = 'test-inst-assign';
const ADMIN_GERAL_ID = 'test-assign-ag';
const ADMIN_SCOPED_ID = 'test-assign-scoped';
const ADMIN_UNSCOPED_ID = 'test-assign-unscoped';
const MINISTRY_ID = 'test-assign-min';
const MEMBER_1_ID = 'test-assign-mb1';
const MEMBER_2_ID = 'test-assign-mb2';
const OUTSIDER_ID = 'test-assign-outsider'; // existe na instituição, mas fora do ministério
const POSITION_1_ID = 'test-assign-ps1';
const POSITION_2_ID = 'test-assign-ps2';

let adminGeralToken: string;
let adminScopedToken: string;
let adminUnscopedToken: string;
let scheduleSeq = 0;

async function cleanupFixtures() {
  const schedules = await prisma.escala.findMany({ where: { ministerioId: MINISTRY_ID }, select: { id: true } });
  const scheduleIds = schedules.map((s) => s.id);
  await prisma.alocacao.deleteMany({ where: { escalaId: { in: scheduleIds } } });
  await prisma.escala.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.evento.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.funcao.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.membroMinisterio.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.ministerio.deleteMany({ where: { id: MINISTRY_ID } });
  await prisma.membro.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.instituicao.deleteMany({ where: { id: INST_ID } });
}

/**
 * Cria uma escala vazia nova (evento novo, id único, horário próprio) para
 * isolar cada teste. Cada chamada usa um DIA diferente (offset por `suffix`):
 * com o motor de conflito agora integrado ao Add real, escalas com o mesmo
 * horário fariam MEMBER_1_ID/POSITION_1_ID (reaproveitados entre testes)
 * colidirem entre si de verdade (RN01/RN09) — o que quebraria testes que só
 * querem uma escala "limpa" de setup, sem relação com o teste de conflito.
 */
async function newSchedule(): Promise<string> {
  const suffix = scheduleSeq++;
  const event = await prisma.evento.create({
    data: {
      id: `test-assign-ev-${suffix}`,
      instituicaoId: INST_ID,
      nome: 'Culto',
      tipo: 'culto',
      inicio: new Date(Date.UTC(2026, 6, 12 + suffix, 18, 0, 0)),
      fim: new Date(Date.UTC(2026, 6, 12 + suffix, 20, 0, 0)),
    },
  });
  const schedule = await prisma.escala.create({
    data: { ministerioId: MINISTRY_ID, eventoId: event.id },
  });
  return schedule.id;
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Alocações' } });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'AG', email: 'ag@test.assign', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_SCOPED_ID, instituicaoId: INST_ID, nome: 'AM Escopado', email: 'ams@test.assign', perfil: 'ADMIN_MINISTERIO' },
      { id: ADMIN_UNSCOPED_ID, instituicaoId: INST_ID, nome: 'AM Sem Escopo', email: 'amu@test.assign', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBER_1_ID, instituicaoId: INST_ID, nome: 'Membro 1', email: 'mb1@test.assign', perfil: 'MEMBRO' },
      { id: MEMBER_2_ID, instituicaoId: INST_ID, nome: 'Membro 2', email: 'mb2@test.assign', perfil: 'MEMBRO' },
      { id: OUTSIDER_ID, instituicaoId: INST_ID, nome: 'Fora do Ministério', email: 'outsider@test.assign', perfil: 'MEMBRO' },
    ],
  });
  await prisma.ministerio.create({ data: { id: MINISTRY_ID, instituicaoId: INST_ID, nome: 'Louvor' } });
  await prisma.membroMinisterio.create({ data: { membroId: ADMIN_SCOPED_ID, ministerioId: MINISTRY_ID, isAdmin: true } });
  await prisma.membroMinisterio.create({ data: { membroId: MEMBER_1_ID, ministerioId: MINISTRY_ID } });
  await prisma.membroMinisterio.create({ data: { membroId: MEMBER_2_ID, ministerioId: MINISTRY_ID } });
  await prisma.funcao.create({ data: { id: POSITION_1_ID, ministerioId: MINISTRY_ID, nome: 'Vocal' } });
  await prisma.funcao.create({ data: { id: POSITION_2_ID, ministerioId: MINISTRY_ID, nome: 'Violão' } });

  adminGeralToken = signTestToken({ memberId: ADMIN_GERAL_ID, institutionId: INST_ID, role: 'ADMIN_GERAL' });
  adminScopedToken = signTestToken({ memberId: ADMIN_SCOPED_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
  adminUnscopedToken = signTestToken({ memberId: ADMIN_UNSCOPED_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('POST /escalas/:id/alocacoes', () => {
  it('admin escopado adiciona um lote (201, com created)', async () => {
    const scheduleId = await newSchedule();

    const res = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminScopedToken}`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.created[0].memberId).toBe(MEMBER_1_ID);
    expect(res.body.data.created[0].conflict).toBe(false);
    expect(res.body.data.failed).toHaveLength(0);
  });

  it('admin SEM isAdmin no ministério da escala recebe 403', async () => {
    const scheduleId = await newSchedule();

    const res = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);

    expect(res.status).toBe(403);
  });

  it('lote misto retorna created e failed no corpo', async () => {
    const scheduleId = await newSchedule();

    const res = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send([
        { memberId: MEMBER_2_ID, positionId: POSITION_2_ID }, // válido
        { memberId: OUTSIDER_ID, positionId: POSITION_1_ID }, // fora do ministério
      ]);

    expect(res.status).toBe(201);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.created[0].memberId).toBe(MEMBER_2_ID);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0].item.memberId).toBe(OUTSIDER_ID);
    expect(res.body.data.failed[0].reason).toBe('Membro não pertence a este ministério');
  });

  it('corpo que não é um array (400)', async () => {
    const scheduleId = await newSchedule();

    const res = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId: MEMBER_1_ID, positionId: POSITION_1_ID });

    expect(res.status).toBe(400);
  });

  it('sem token (401)', async () => {
    const scheduleId = await newSchedule();
    const res = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /alocacoes/:id', () => {
  it('edição válida (200)', async () => {
    const scheduleId = await newSchedule();
    const created = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);
    const assignmentId = created.body.data.created[0].id;

    const res = await request(app)
      .patch(`/alocacoes/${assignmentId}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ positionId: POSITION_2_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.positionId).toBe(POSITION_2_ID);
  });

  it('edição que resultaria em duplicata (409)', async () => {
    const scheduleId = await newSchedule();
    const created = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send([
        { memberId: MEMBER_1_ID, positionId: POSITION_1_ID },
        { memberId: MEMBER_2_ID, positionId: POSITION_2_ID },
      ]);
    const [first, second] = created.body.data.created;

    // tenta fazer a segunda alocação virar igual à primeira
    const res = await request(app)
      .patch(`/alocacoes/${second.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ memberId: first.memberId, positionId: first.positionId });

    expect(res.status).toBe(409);
  });

  it('sem permissão (403)', async () => {
    const scheduleId = await newSchedule();
    const created = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);
    const assignmentId = created.body.data.created[0].id;

    const res = await request(app)
      .patch(`/alocacoes/${assignmentId}`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`)
      .send({ positionId: POSITION_2_ID });

    expect(res.status).toBe(403);
  });

  it('inexistente (404)', async () => {
    const res = await request(app)
      .patch('/alocacoes/nao-existe')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ positionId: POSITION_2_ID });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /alocacoes/:id', () => {
  it('remove com sucesso (200)', async () => {
    const scheduleId = await newSchedule();
    const created = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);
    const assignmentId = created.body.data.created[0].id;

    const res = await request(app)
      .delete(`/alocacoes/${assignmentId}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(await prisma.alocacao.findUnique({ where: { id: assignmentId } })).toBeNull();
  });

  it('inexistente (404)', async () => {
    const res = await request(app)
      .delete('/alocacoes/nao-existe')
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
  });

  it('sem permissão (403)', async () => {
    const scheduleId = await newSchedule();
    const created = await request(app)
      .post(`/escalas/${scheduleId}/alocacoes`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send([{ memberId: MEMBER_1_ID, positionId: POSITION_1_ID }]);
    const assignmentId = created.body.data.created[0].id;

    const res = await request(app)
      .delete(`/alocacoes/${assignmentId}`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`);

    expect(res.status).toBe(403);
  });
});
