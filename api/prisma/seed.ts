import { PerfilUsuario, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Substitua pelo SEU e-mail do Google antes de testar o login.
// O callback do OAuth precisa encontrar um Membro convidado (contaId nulo)
// com este e-mail — caso contrário o acesso é negado (403).
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'SEU_EMAIL_GOOGLE_AQUI').toLowerCase();
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrador Geral';

// Dados de teste (ministérios, membros e vínculos) para exercitar a associação
// e o convite escopado por ministério. Não são criados em produção; use
// SEED_TEST_DATA=false para desativar também em dev.
const SEED_TEST_DATA =
  process.env.NODE_ENV !== 'production' && process.env.SEED_TEST_DATA !== 'false';

// Ids fixos e legíveis para o seed ser idempotente (re-rodar não duplica).
const TEST_MINISTRIES = [
  { id: 'seed-min-louvor', nome: 'Louvor', descricao: 'Equipe de música e adoração' },
  { id: 'seed-min-recepcao', nome: 'Recepção', descricao: 'Acolhimento na entrada' },
  { id: 'seed-min-midia', nome: 'Mídia', descricao: 'Som, projeção e transmissão' },
];

const TEST_MEMBERS: Array<{
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
}> = [
  // Ana já administra o Louvor (isAdmin abaixo); por isso o perfil ADMIN_MINISTERIO.
  { id: 'seed-mem-ana', nome: 'Ana Souza', email: 'ana@escacev.test', perfil: 'ADMIN_MINISTERIO' },
  // Bruno participa do Louvor (não-admin) — alvo do promover/rebaixar.
  { id: 'seed-mem-bruno', nome: 'Bruno Lima', email: 'bruno@escacev.test', perfil: 'MEMBRO' },
  // Carla existe mas NÃO está no Louvor — caminho "só associa" do convite.
  { id: 'seed-mem-carla', nome: 'Carla Dias', email: 'carla@escacev.test', perfil: 'MEMBRO' },
  // Diego existe e está solto — alvo do POST associar membro existente.
  { id: 'seed-mem-diego', nome: 'Diego Melo', email: 'diego@escacev.test', perfil: 'MEMBRO' },
];

// Vínculos iniciais no Louvor: Ana admin, Bruno participante.
const TEST_MEMBERSHIPS = [
  { id: 'seed-mm-ana-louvor', membroId: 'seed-mem-ana', ministerioId: 'seed-min-louvor', isAdmin: true },
  { id: 'seed-mm-bruno-louvor', membroId: 'seed-mem-bruno', ministerioId: 'seed-min-louvor', isAdmin: false },
];

async function main() {
  const instituicaoId = process.env.INSTITUTION_ID ?? 'inst-escacev';

  const instituicao = await prisma.instituicao.upsert({
    where: { id: instituicaoId },
    update: {},
    create: {
      id: instituicaoId,
      nome: process.env.INSTITUTION_NAME ?? 'Minha Igreja',
    },
  });

  // Membro ADMIN_GERAL como convite pendente (sem Conta vinculada ainda).
  // No primeiro login com Google, o callback vincula a Conta a este Membro.
  const existingAdmin = await prisma.membro.findFirst({
    where: { instituicaoId: instituicao.id, email: ADMIN_EMAIL },
  });

  if (!existingAdmin) {
    await prisma.membro.create({
      data: {
        instituicaoId: instituicao.id,
        nome: ADMIN_NAME,
        email: ADMIN_EMAIL,
        perfil: 'ADMIN_GERAL',
        contaId: null, // convite pendente
      },
    });
    console.log(`Seed: Membro ADMIN_GERAL convidado (${ADMIN_EMAIL}).`);
  } else {
    console.log(`Seed: Membro ADMIN_GERAL já existe (${ADMIN_EMAIL}).`);
  }

  if (SEED_TEST_DATA) {
    // Ministérios de teste (upsert por id fixo — idempotente).
    for (const m of TEST_MINISTRIES) {
      await prisma.ministerio.upsert({
        where: { id: m.id },
        update: { nome: m.nome, descricao: m.descricao },
        create: { id: m.id, instituicaoId: instituicao.id, nome: m.nome, descricao: m.descricao },
      });
    }

    // Membros de teste (convites pendentes: contaId nulo).
    for (const p of TEST_MEMBERS) {
      await prisma.membro.upsert({
        where: { id: p.id },
        update: { nome: p.nome, perfil: p.perfil },
        create: {
          id: p.id,
          instituicaoId: instituicao.id,
          nome: p.nome,
          email: p.email,
          perfil: p.perfil,
          contaId: null,
        },
      });
    }

    // Vínculos iniciais no Louvor (Ana admin, Bruno participante).
    for (const v of TEST_MEMBERSHIPS) {
      await prisma.membroMinisterio.upsert({
        where: { membroId_ministerioId: { membroId: v.membroId, ministerioId: v.ministerioId } },
        update: { isAdmin: v.isAdmin },
        create: {
          id: v.id,
          membroId: v.membroId,
          ministerioId: v.ministerioId,
          isAdmin: v.isAdmin,
        },
      });
    }

    console.log(
      `Seed (teste): ${TEST_MINISTRIES.length} ministérios, ${TEST_MEMBERS.length} membros, ` +
        `${TEST_MEMBERSHIPS.length} vínculos no Louvor.`,
    );
  }

  console.log('Seed concluído: instituição e admin convidado prontos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
