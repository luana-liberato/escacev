import request from 'supertest';
import { app } from '../../../../app';
import { prisma } from '../../../database/prisma';
import { signTestToken } from '../../../../test/testAuth';

/**
 * Integração/E2E da visão do membro (GET /minhas-escalas). Foco na regra RN04
 * (só escalas PUBLICADA chegam ao membro — rascunho é invisível), no isolamento
 * por membro, no recorte por período e na ordenação por início do evento.
 * Fixtures determinísticas em MARÇO/2026 (consultadas com ?from&?to explícitos) +
 * um evento em "agora" para exercitar o mês corrente. Limpas em afterAll.
 */
const INST_ID = 'test-mine-inst';
const MEMBER_ID = 'test-mine-membro';
const OTHER_MEMBER_ID = 'test-mine-outro';
const MINISTRY_ID = 'test-mine-min';
const POSITION_ID = 'test-mine-pos';

let memberToken: string;

async function cleanupFixtures() {
  const schedules = await prisma.escala.findMany({ where: { ministerioId: MINISTRY_ID }, select: { id: true } });
  await prisma.alocacao.deleteMany({ where: { escalaId: { in: schedules.map((s) => s.id) } } });
  await prisma.escala.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.funcao.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.evento.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.membroMinisterio.deleteMany({ where: { ministerioId: MINISTRY_ID } });
  await prisma.ministerio.deleteMany({ where: { id: MINISTRY_ID } });
  await prisma.membro.deleteMany({ where: { instituicaoId: INST_ID } });
  await prisma.instituicao.deleteMany({ where: { id: INST_ID } });
}

/** Cria evento + escala (status dado) + aloca o membro; devolve o id da escala. */
async function scheduleWithAssignment(opts: {
  eventId: string;
  starts: Date;
  ends: Date;
  status: 'RASCUNHO' | 'PUBLICADA';
  memberId: string;
  name?: string;
}): Promise<void> {
  await prisma.evento.create({
    data: { id: opts.eventId, instituicaoId: INST_ID, nome: `Evento ${opts.eventId}`, tipo: 'culto', inicio: opts.starts, fim: opts.ends },
  });
  const escala = await prisma.escala.create({
    data: {
      ministerioId: MINISTRY_ID,
      eventoId: opts.eventId,
      nome: opts.name ?? '',
      status: opts.status,
      publicadaEm: opts.status === 'PUBLICADA' ? new Date() : null,
    },
  });
  await prisma.alocacao.create({
    data: { escalaId: escala.id, membroId: opts.memberId, funcaoId: POSITION_ID },
  });
}

beforeAll(async () => {
  await cleanupFixtures();

  await prisma.instituicao.create({ data: { id: INST_ID, nome: 'Inst Minhas Escalas' } });
  await prisma.membro.createMany({
    data: [
      { id: MEMBER_ID, instituicaoId: INST_ID, nome: 'Membro', email: 'membro@test.mine', perfil: 'MEMBRO' },
      { id: OTHER_MEMBER_ID, instituicaoId: INST_ID, nome: 'Outro', email: 'outro@test.mine', perfil: 'MEMBRO' },
    ],
  });
  await prisma.ministerio.create({ data: { id: MINISTRY_ID, instituicaoId: INST_ID, nome: 'Louvor' } });
  await prisma.funcao.create({ data: { id: POSITION_ID, ministerioId: MINISTRY_ID, nome: 'Vocal' } });

  // Março/2026: duas PUBLICADAS do membro (em datas fora de ordem para testar o sort),
  // uma RASCUNHO do membro (deve sumir, RN04) e uma PUBLICADA de OUTRO membro.
  await scheduleWithAssignment({
    eventId: 'test-mine-ev-mar10', starts: new Date('2026-03-10T18:00:00Z'), ends: new Date('2026-03-10T20:00:00Z'),
    status: 'PUBLICADA', memberId: MEMBER_ID,
  });
  await scheduleWithAssignment({
    eventId: 'test-mine-ev-mar05', starts: new Date('2026-03-05T18:00:00Z'), ends: new Date('2026-03-05T20:00:00Z'),
    status: 'PUBLICADA', memberId: MEMBER_ID,
  });
  await scheduleWithAssignment({
    eventId: 'test-mine-ev-mar11-draft', starts: new Date('2026-03-11T18:00:00Z'), ends: new Date('2026-03-11T20:00:00Z'),
    status: 'RASCUNHO', memberId: MEMBER_ID,
  });
  await scheduleWithAssignment({
    eventId: 'test-mine-ev-mar10-other', starts: new Date('2026-03-10T18:00:00Z'), ends: new Date('2026-03-10T20:00:00Z'),
    status: 'PUBLICADA', memberId: OTHER_MEMBER_ID, name: 'Sala 2',
  });

  // Evento em "agora" (mês corrente), publicado, do membro — para o padrão sem ?from&?to.
  const now = new Date();
  await scheduleWithAssignment({
    eventId: 'test-mine-ev-now', starts: now, ends: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    status: 'PUBLICADA', memberId: MEMBER_ID,
  });

  memberToken = signTestToken({ memberId: MEMBER_ID, institutionId: INST_ID, role: 'MEMBRO' });
});

afterAll(async () => {
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('GET /minhas-escalas', () => {
  it('período explícito: só PUBLICADA do próprio membro, ordenadas por início (RN04)', async () => {
    const res = await request(app)
      .get('/minhas-escalas')
      .query({ from: '2026-03-01T00:00:00Z', to: '2026-03-31T23:59:59Z' })
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 2 publicadas do membro (mar05 e mar10); rascunho e a de OUTRO membro fora.
    expect(res.body.data.entries).toHaveLength(2);
    // Ordenadas por início: mar05 antes de mar10.
    expect(res.body.data.entries[0].eventId).toBe('test-mine-ev-mar05');
    expect(res.body.data.entries[1].eventId).toBe('test-mine-ev-mar10');
    expect(res.body.data.entries[0].ministryName).toBe('Louvor');
    expect(res.body.data.entries[0].positionName).toBe('Vocal');
    // Nenhuma entry de rascunho.
    expect(res.body.data.entries.some((e: { eventId: string }) => e.eventId.includes('draft'))).toBe(false);
  });

  it('rascunho NÃO aparece mesmo com o período o cobrindo (RN04)', async () => {
    const res = await request(app)
      .get('/minhas-escalas')
      .query({ from: '2026-03-11T00:00:00Z', to: '2026-03-11T23:59:59Z' })
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.entries).toEqual([]);
  });

  it('sem ?from&?to: cai no mês corrente e traz o evento de "agora"', async () => {
    const res = await request(app).get('/minhas-escalas').set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    // As de março ficam fora do mês corrente; sobra a de "agora".
    expect(res.body.data.entries.map((e: { eventId: string }) => e.eventId)).toContain('test-mine-ev-now');
    expect(res.body.data.entries.some((e: { eventId: string }) => e.eventId.startsWith('test-mine-ev-mar'))).toBe(false);
  });

  it('400 quando só um dos parâmetros é informado', async () => {
    const res = await request(app)
      .get('/minhas-escalas')
      .query({ from: '2026-03-01T00:00:00Z' })
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(400);
  });

  it('400 quando from é depois de to', async () => {
    const res = await request(app)
      .get('/minhas-escalas')
      .query({ from: '2026-03-31T00:00:00Z', to: '2026-03-01T00:00:00Z' })
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(400);
  });

  it('sem token: 401', async () => {
    const res = await request(app).get('/minhas-escalas');
    expect(res.status).toBe(401);
  });
});
