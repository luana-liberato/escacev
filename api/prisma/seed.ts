import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Substitua pelo SEU e-mail do Google antes de testar o login.
// O callback do OAuth precisa encontrar um Membro convidado (contaId nulo)
// com este e-mail — caso contrário o acesso é negado (403).
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'SEU_EMAIL_GOOGLE_AQUI').toLowerCase();
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrador Geral';

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

  console.log('Seed concluído: instituição e admin convidado prontos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
