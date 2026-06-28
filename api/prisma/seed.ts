import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.instituicao.upsert({
    where: { id: process.env.INSTITUTION_ID ?? 'inst-escacev' },
    update: {},
    create: {
      id: process.env.INSTITUTION_ID ?? 'inst-escacev',
      nome: process.env.INSTITUTION_NAME ?? 'Minha Igreja',
    },
  });
  console.log('Seed concluído: instituição criada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
