-- DropForeignKey
ALTER TABLE "membros" DROP CONSTRAINT "membros_contaId_fkey";

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
