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
const POSITION_ID = 'test-sched-pos';
const POSITION_2_ID = 'test-sched-pos-2';

let adminGeralToken: string;
let adminScopedToken: string;
let adminUnscopedToken: string;
let membroToken: string;
let eventSeq = 0;

async function cleanupFixtures() {
  const schedules = await prisma.escala.findMany({ where: { ministerioId: MINISTRY_ID }, select: { id: true } });
  await prisma.alocacao.deleteMany({ where: { escalaId: { in: schedules.map((s) => s.id) } } });
  await prisma.escala.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.funcao.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.evento.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.membroMinisterio.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.ministerio.deleteMany({ where: { id: MINISTRY_ID } });
  await prisma.membro.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

/**
 * Cria um evento novo (id único) para cada teste, evitando colisão do @@unique.
 * Cada evento cai num DIA distinto (offset por eventSeq) para NÃO se sobrepor no
 * horário com os eventos de outros testes — a varredura de conflito é
 * institution-wide e centrada no membro (o MEMBRO_ID é reusado entre testes), então
 * horários iguais gerariam conflito cruzado indesejado. Testes que QUEREM conflito
 * alocam no MESMO evento (mesma janela), única sobreposição proposital.
 */
async function newEvent(institutionId = INST_ID): Promise<string> {
  const seq = eventSeq++;
  const id = `test-sched-ev-${seq}`;
  const start = new Date(Date.UTC(2026, 6, 12, 18, 0, 0) + seq * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  await prisma.evento.create({
    data: { id, instituicaoId: institutionId, nome: 'Culto', tipo: 'culto', inicio: start, fim: end },
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
  await prisma.membroMinisterio.create({ data: { membroId: MEMBRO_ID, ministerioId: MINISTRY_ID } });
  await prisma.funcao.create({ data: { id: POSITION_ID, ministerioId: MINISTRY_ID, nome: 'Vocal' } });
  // Segunda função, SEM par na matriz de compatibilidade -> incompatível com a
  // primeira (RN02): usada para forjar um conflito na consulta de conflitos.
  await prisma.funcao.create({ data: { id: POSITION_2_ID, ministerioId: MINISTRY_ID, nome: 'Violão' } });

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

  it('ver por id retorna a escala COM as alocações (membro e função resolvidos)', async () => {
    const eventId = await newEvent();
    const created = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });
    const scheduleId = created.body.data.id;
    await prisma.alocacao.create({
      data: { escalaId: scheduleId, membroId: MEMBRO_ID, funcaoId: POSITION_ID },
    });

    const res = await request(app).get(`/escalas/${scheduleId}`).set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.assignments).toHaveLength(1);
    expect(res.body.data.assignments[0].member.name).toBe('MB');
    expect(res.body.data.assignments[0].position.name).toBe('Vocal');
    expect(res.body.data.assignments[0].conflict).toBe(false);
  });

  it('MEMBRO lista só escalas PUBLICADA de ministério que participa (200)', async () => {
    const evPub = await newEvent();
    const pub = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId: evPub });
    await prisma.escala.update({ where: { id: pub.body.data.id }, data: { status: 'PUBLICADA', publicadaEm: new Date() } });
    const evDraft = await newEvent();
    const draft = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId: evDraft });

    const res = await request(app).get('/escalas').set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((x: { id: string }) => x.id);
    expect(ids).toContain(pub.body.data.id);
    expect(ids).not.toContain(draft.body.data.id);
    expect(res.body.data.every((x: { status: string }) => x.status === 'PUBLICADA')).toBe(true);
  });

  it('MEMBRO vê por id escala publicada do seu ministério (200); 404 em rascunho', async () => {
    const ev = await newEvent();
    const created = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId: ev });

    const asDraft = await request(app).get(`/escalas/${created.body.data.id}`).set('Authorization', `Bearer ${membroToken}`);
    expect(asDraft.status).toBe(404);

    await prisma.escala.update({ where: { id: created.body.data.id }, data: { status: 'PUBLICADA', publicadaEm: new Date() } });
    const asPublished = await request(app).get(`/escalas/${created.body.data.id}`).set('Authorization', `Bearer ${membroToken}`);
    expect(asPublished.status).toBe(200);
  });

  it('ADMIN_MINISTERIO que NÃO participa do ministério não vê suas escalas (lista sem ela; :id 404)', async () => {
    const eventId = await newEvent();
    const created = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });
    const scheduleId = created.body.data.id;
    // Mesmo publicada: o admin sem vínculo com o ministério não a enxerga.
    await prisma.escala.update({ where: { id: scheduleId }, data: { status: 'PUBLICADA', publicadaEm: new Date() } });

    const list = await request(app).get('/escalas').query({ eventId }).set('Authorization', `Bearer ${adminUnscopedToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((x: { id: string }) => x.id)).not.toContain(scheduleId);

    const byId = await request(app).get(`/escalas/${scheduleId}`).set('Authorization', `Bearer ${adminUnscopedToken}`);
    expect(byId.status).toBe(404);
  });

  it('ADMIN_MINISTERIO que SÓ participa (não administra) vê publicada, mas não o rascunho', async () => {
    // Vincula o admin sem escopo ao ministério como MEMBRO (isAdmin=false).
    await prisma.membroMinisterio.create({
      data: { membroId: ADMIN_UNSCOPED_ID, ministerioId: MINISTRY_ID, isAdmin: false },
    });
    try {
      const eventId = await newEvent();
      const created = await request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId });
      const scheduleId = created.body.data.id;

      // Rascunho: invisível a quem só participa (RN04) — 404.
      const asDraft = await request(app).get(`/escalas/${scheduleId}`).set('Authorization', `Bearer ${adminUnscopedToken}`);
      expect(asDraft.status).toBe(404);

      // Publicada: passa a ver.
      await prisma.escala.update({ where: { id: scheduleId }, data: { status: 'PUBLICADA', publicadaEm: new Date() } });
      const asPublished = await request(app).get(`/escalas/${scheduleId}`).set('Authorization', `Bearer ${adminUnscopedToken}`);
      expect(asPublished.status).toBe(200);
    } finally {
      await prisma.membroMinisterio.deleteMany({ where: { membroId: ADMIN_UNSCOPED_ID, ministerioId: MINISTRY_ID } });
    }
  });
});

describe('GET /escalas/:id/conflitos', () => {
  /** Cria uma escala e aloca o MESMO membro em duas funções incompatíveis (conflito). */
  async function scheduleWithConflict(): Promise<string> {
    const eventId = await newEvent();
    const created = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ ministryId: MINISTRY_ID, eventId });
    const scheduleId = created.body.data.id;
    await prisma.alocacao.createMany({
      data: [
        { escalaId: scheduleId, membroId: MEMBRO_ID, funcaoId: POSITION_ID },
        { escalaId: scheduleId, membroId: MEMBRO_ID, funcaoId: POSITION_2_ID },
      ],
    });
    return scheduleId;
  }

  it('reavalia ao vivo e retorna as alocações em conflito com nomes legíveis (200)', async () => {
    const scheduleId = await scheduleWithConflict();

    const res = await request(app)
      .get(`/escalas/${scheduleId}/conflitos`)
      .set('Authorization', `Bearer ${adminScopedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Cada uma das duas funções aponta a outra como conflitante.
    expect(res.body.data.conflicts).toHaveLength(2);
    const entry = res.body.data.conflicts[0];
    expect(entry.assignment.member.name).toBe('MB');
    expect(entry.conflicts[0].memberName).toBe('MB');
    expect(entry.conflicts[0].positionName).toBeTruthy();
  });

  it('escala sem conflito retorna conflicts vazio (200)', async () => {
    const eventId = await newEvent();
    const created = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ ministryId: MINISTRY_ID, eventId });
    await prisma.alocacao.create({
      data: { escalaId: created.body.data.id, membroId: MEMBRO_ID, funcaoId: POSITION_ID },
    });

    const res = await request(app)
      .get(`/escalas/${created.body.data.id}/conflitos`)
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.conflicts).toEqual([]);
  });

  it('MEMBRO recebe 404 nos conflitos de uma escala RASCUNHO', async () => {
    const scheduleId = await scheduleWithConflict();
    const res = await request(app)
      .get(`/escalas/${scheduleId}/conflitos`)
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(404);
  });

  it('MEMBRO vê os conflitos de uma escala PUBLICADA do seu ministério (200)', async () => {
    const scheduleId = await scheduleWithConflict();
    await prisma.escala.update({ where: { id: scheduleId }, data: { status: 'PUBLICADA', publicadaEm: new Date() } });
    const res = await request(app)
      .get(`/escalas/${scheduleId}/conflitos`)
      .set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('404 para escala inexistente', async () => {
    const res = await request(app)
      .get('/escalas/nao-existe/conflitos')
      .set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
  });

  it('RN07: prioridade por publicação — a escala publicada ANTES prevalece (E2E, publicadaEm real)', async () => {
    // Duas escalas do mesmo ministério no MESMO evento (sobreposição total), o
    // mesmo membro em funções incompatíveis. A é publicada antes de B.
    const eventId = await newEvent();
    const post = (name?: string) =>
      request(app).post('/escalas').set('Authorization', `Bearer ${adminGeralToken}`).send({ ministryId: MINISTRY_ID, eventId, name });
    const schedA = (await post()).body.data.id;
    const schedB = (await post('Sala 2')).body.data.id;
    await prisma.alocacao.create({ data: { escalaId: schedA, membroId: MEMBRO_ID, funcaoId: POSITION_ID } });
    await prisma.alocacao.create({ data: { escalaId: schedB, membroId: MEMBRO_ID, funcaoId: POSITION_2_ID } });
    // publicadaEm determinístico: A antes de B.
    await prisma.escala.update({ where: { id: schedA }, data: { status: 'PUBLICADA', publicadaEm: new Date('2026-01-01T00:00:00Z') } });
    await prisma.escala.update({ where: { id: schedB }, data: { status: 'PUBLICADA', publicadaEm: new Date('2026-02-01T00:00:00Z') } });

    // Consultando os conflitos de B (publicada depois): o conflito aponta A, que prevalece.
    const resB = await request(app).get(`/escalas/${schedB}/conflitos`).set('Authorization', `Bearer ${adminGeralToken}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.conflicts[0].conflicts[0].scheduleId).toBe(schedA);
    expect(resB.body.data.conflicts[0].conflicts[0].existingHasPrecedence).toBe(true);

    // Consultando os conflitos de A (publicada antes): o conflito aponta B, que NÃO prevalece.
    const resA = await request(app).get(`/escalas/${schedA}/conflitos`).set('Authorization', `Bearer ${adminGeralToken}`);
    expect(resA.body.data.conflicts[0].conflicts[0].scheduleId).toBe(schedB);
    expect(resA.body.data.conflicts[0].conflicts[0].existingHasPrecedence).toBe(false);
  });
});

describe('PATCH /escalas/:id/publicar', () => {
  async function draftSchedule(token = adminGeralToken): Promise<string> {
    const eventId = await newEvent();
    const created = await request(app)
      .post('/escalas')
      .set('Authorization', `Bearer ${token}`)
      .send({ ministryId: MINISTRY_ID, eventId });
    return created.body.data.id;
  }

  it('admin escopado publica (200, PUBLICADA + publishedAt)', async () => {
    const scheduleId = await draftSchedule(adminScopedToken);

    const res = await request(app)
      .patch(`/escalas/${scheduleId}/publicar`)
      .set('Authorization', `Bearer ${adminScopedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLICADA');
    expect(res.body.data.publishedAt).not.toBeNull();
    const row = await prisma.escala.findUnique({ where: { id: scheduleId } });
    expect(row?.status).toBe('PUBLICADA');
    expect(row?.publicadaEm).not.toBeNull();
  });

  it('republicar retorna 409 e mantém a publicadaEm original', async () => {
    const scheduleId = await draftSchedule();
    const first = await request(app).patch(`/escalas/${scheduleId}/publicar`).set('Authorization', `Bearer ${adminGeralToken}`);
    const publishedAt = first.body.data.publishedAt;

    const again = await request(app).patch(`/escalas/${scheduleId}/publicar`).set('Authorization', `Bearer ${adminGeralToken}`);
    expect(again.status).toBe(409);
    const row = await prisma.escala.findUnique({ where: { id: scheduleId } });
    expect(row?.publicadaEm?.toISOString()).toBe(publishedAt);
  });

  it('admin SEM escopo naquele ministério recebe 403 (escala continua RASCUNHO)', async () => {
    const scheduleId = await draftSchedule();

    const res = await request(app)
      .patch(`/escalas/${scheduleId}/publicar`)
      .set('Authorization', `Bearer ${adminUnscopedToken}`);
    expect(res.status).toBe(403);
    expect((await prisma.escala.findUnique({ where: { id: scheduleId } }))?.status).toBe('RASCUNHO');
  });

  it('MEMBRO não pode publicar (403)', async () => {
    const scheduleId = await draftSchedule();
    const res = await request(app).patch(`/escalas/${scheduleId}/publicar`).set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(403);
  });

  it('404 para escala inexistente', async () => {
    const res = await request(app).patch('/escalas/nao-existe/publicar').set('Authorization', `Bearer ${adminGeralToken}`);
    expect(res.status).toBe(404);
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
