import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Testes de integração/E2E dos endpoints de Event, contra o Postgres real
 * (Docker de dev). Cobre principalmente RBAC — a lógica de negócio já está
 * coberta nos testes unitários dos use cases (EventUseCases.test.ts).
 *
 * Fixtures próprias, com ids prefixados "test-", isoladas do seed de dev e
 * limpas em afterAll (institution/ministry/members/events são exclusivos
 * deste arquivo de teste).
 */
const INST_ID = 'test-inst-events';
const OTHER_INST_ID = 'test-inst-events-other';
const MINISTRY_ID = 'test-min-events';
const ADMIN_GERAL_ID = 'test-admin-geral-events';
const ADMIN_MINISTERIO_ID = 'test-admin-ministerio-events';
const MEMBRO_ID = 'test-membro-events';

let adminGeralToken: string;
let adminMinisterioToken: string;
let membroToken: string;

async function cleanupFixtures() {
  await prisma.escala.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.evento.deleteMany({ where: { instituicaoId: { in: [INST_ID, OTHER_INST_ID] } } });
  await prisma.membro.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.ministerio.deleteMany({ where: { id: MINISTRY_ID } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [INST_ID, OTHER_INST_ID] } } });
}

beforeAll(async () => {
  await cleanupFixtures(); // defensivo: limpa resíduo de uma run anterior que falhou

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Instituição de Teste (Eventos)' } });
  await prisma.instituicao.create({ data: { id: OTHER_INST_ID, nome: 'Outra Instituição de Teste' } });
  await prisma.ministerio.create({
    data: { id: MINISTRY_ID, instituicaoId: INST_ID, nome: 'Ministério de Teste (Eventos)' },
  });
  await prisma.membro.createMany({
    data: [
      { id: ADMIN_GERAL_ID, instituicaoId: INST_ID, nome: 'Admin Geral Teste', email: 'admin-geral@test.escacev', perfil: 'ADMIN_GERAL' },
      { id: ADMIN_MINISTERIO_ID, instituicaoId: INST_ID, nome: 'Admin Ministério Teste', email: 'admin-ministerio@test.escacev', perfil: 'ADMIN_MINISTERIO' },
      { id: MEMBRO_ID, instituicaoId: INST_ID, nome: 'Membro Teste', email: 'membro@test.escacev', perfil: 'MEMBRO' },
    ],
  });

  adminGeralToken = signTestToken({ memberId: ADMIN_GERAL_ID, institutionId: INST_ID, role: 'ADMIN_GERAL' });
  adminMinisterioToken = signTestToken({ memberId: ADMIN_MINISTERIO_ID, institutionId: INST_ID, role: 'ADMIN_MINISTERIO' });
  membroToken = signTestToken({ memberId: MEMBRO_ID, institutionId: INST_ID, role: 'MEMBRO' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('POST /eventos', () => {
  it('ADMIN_MINISTERIO cria evento (201)', async () => {
    const res = await request(app)
      .post('/eventos')
      .set('Authorization', `Bearer ${adminMinisterioToken}`)
      .send({
        name: 'Culto de Domingo',
        type: 'SERVICE',
        startsAt: '2026-07-12T18:00:00.000Z',
        endsAt: '2026-07-12T20:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('SERVICE');
  });

  it('ADMIN_GERAL cria evento (201)', async () => {
    const res = await request(app)
      .post('/eventos')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({
        name: 'Ensaio Geral',
        type: 'REHEARSAL',
        startsAt: '2026-07-13T18:00:00.000Z',
        endsAt: '2026-07-13T20:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('REHEARSAL');
  });

  it('rejeita endsAt <= startsAt (400)', async () => {
    const res = await request(app)
      .post('/eventos')
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({
        name: 'Evento Inválido',
        type: 'SERVICE',
        startsAt: '2026-07-12T20:00:00.000Z',
        endsAt: '2026-07-12T18:00:00.000Z',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('MEMBRO não pode criar evento (403)', async () => {
    const res = await request(app)
      .post('/eventos')
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: 'X', type: 'SERVICE', startsAt: '2026-07-12T18:00:00.000Z', endsAt: '2026-07-12T20:00:00.000Z' });

    expect(res.status).toBe(403);
  });

  it('sem token (401)', async () => {
    const res = await request(app)
      .post('/eventos')
      .send({ name: 'X', type: 'SERVICE', startsAt: '2026-07-12T18:00:00.000Z', endsAt: '2026-07-12T20:00:00.000Z' });

    expect(res.status).toBe(401);
  });
});

describe('GET /eventos', () => {
  const D = (s: string) => `2026-${s}`;

  beforeAll(async () => {
    // Três eventos em meses diferentes, para o filtro de período.
    await prisma.evento.createMany({
      data: [
        { id: 'test-ev-jul', instituicaoId: INST_ID, nome: 'Culto Julho', tipo: 'culto', inicio: new Date(D('07-05T18:00:00.000Z')), fim: new Date(D('07-05T20:00:00.000Z')) },
        { id: 'test-ev-vira-mes', instituicaoId: INST_ID, nome: 'Vira-mês', tipo: 'especial', inicio: new Date(D('07-31T22:00:00.000Z')), fim: new Date('2026-08-01T01:00:00.000Z') },
        { id: 'test-ev-ago', instituicaoId: INST_ID, nome: 'Ensaio Agosto', tipo: 'ensaio', inicio: new Date('2026-08-05T19:00:00.000Z'), fim: new Date('2026-08-05T21:00:00.000Z') },
      ],
    });
  });

  it('lista sem filtro retorna eventos da instituição (200)', async () => {
    const res = await request(app).get('/eventos').set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.every((e: { institutionId: string }) => e.institutionId === INST_ID)).toBe(true);
  });

  it('lista com from/to retorna só os que sobrepõem a janela (200)', async () => {
    const res = await request(app)
      .get('/eventos')
      .query({ from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((e: { name: string }) => e.name);
    expect(names).toEqual(expect.arrayContaining(['Culto Julho', 'Vira-mês']));
    expect(names).not.toContain('Ensaio Agosto');
  });

  it('sem token (401)', async () => {
    const res = await request(app).get('/eventos');
    expect(res.status).toBe(401);
  });

  it('MEMBRO lista os eventos da instituição (200)', async () => {
    const res = await request(app).get('/eventos').set('Authorization', `Bearer ${membroToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.every((e: { institutionId: string }) => e.institutionId === INST_ID)).toBe(true);
  });
});

describe('GET /eventos/:id', () => {
  it('404 quando o evento é de outra instituição', async () => {
    const foreign = await prisma.evento.create({
      data: { id: 'test-ev-foreign', instituicaoId: OTHER_INST_ID, nome: 'Evento de Outra Instituição', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .get(`/eventos/${foreign.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(404);
  });

  it('MEMBRO vê um evento da própria instituição (200)', async () => {
    const res = await request(app)
      .get('/eventos/test-ev-jul')
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Culto Julho');
  });
});

describe('PUT /eventos/:id', () => {
  it('ADMIN_GERAL edita (200)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-put-geral', instituicaoId: INST_ID, nome: 'Original', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .put(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`)
      .send({ name: 'Editado por ADMIN_GERAL' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Editado por ADMIN_GERAL');
  });

  it('ADMIN_MINISTERIO edita (200)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-put-ministerio', instituicaoId: INST_ID, nome: 'Original', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .put(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${adminMinisterioToken}`)
      .send({ name: 'Editado por ADMIN_MINISTERIO' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Editado por ADMIN_MINISTERIO');
  });

  it('MEMBRO não pode editar (403)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-put-membro', instituicaoId: INST_ID, nome: 'Original', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .put(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${membroToken}`)
      .send({ name: 'Tentativa' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /eventos/:id', () => {
  it('ADMIN_GERAL remove evento sem escala (200)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-delete-ok', instituicaoId: INST_ID, nome: 'Para remover', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .delete(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(200);
    expect(await prisma.evento.findUnique({ where: { id: event.id } })).toBeNull();
  });

  it('ADMIN_GERAL não remove evento com escala vinculada (409)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-delete-blocked', instituicaoId: INST_ID, nome: 'Com escala', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });
    await prisma.escala.create({
      data: { id: 'test-esc-blocking', ministerioId: MINISTRY_ID, eventoId: event.id },
    });

    const res = await request(app)
      .delete(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${adminGeralToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('escalas vinculadas');

    await prisma.escala.delete({ where: { id: 'test-esc-blocking' } }); // libera para o afterAll limpar o evento
  });

  it('ADMIN_MINISTERIO remove evento sem escala (200)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-delete-ministerio', instituicaoId: INST_ID, nome: 'Removível pelo admin de grupo', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .delete(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${adminMinisterioToken}`);

    expect(res.status).toBe(200);
    expect(await prisma.evento.findUnique({ where: { id: event.id } })).toBeNull();
  });

  it('MEMBRO não pode remover (403)', async () => {
    const event = await prisma.evento.create({
      data: { id: 'test-ev-delete-forbidden', instituicaoId: INST_ID, nome: 'Protegido', tipo: 'culto', inicio: new Date('2026-07-12T18:00:00.000Z'), fim: new Date('2026-07-12T20:00:00.000Z') },
    });

    const res = await request(app)
      .delete(`/eventos/${event.id}`)
      .set('Authorization', `Bearer ${membroToken}`);

    expect(res.status).toBe(403);
  });
});
