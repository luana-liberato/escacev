-- DropForeignKey
ALTER TABLE "vagas_evento" DROP CONSTRAINT "vagas_evento_eventoId_fkey";

-- DropForeignKey
ALTER TABLE "vagas_evento" DROP CONSTRAINT "vagas_evento_funcaoId_fkey";

-- DropForeignKey
ALTER TABLE "alocacoes" DROP CONSTRAINT "alocacoes_vagaId_fkey";

-- DropIndex
DROP INDEX "alocacoes_escalaId_vagaId_membroId_key";

-- AlterTable
ALTER TABLE "alocacoes" DROP COLUMN "vagaId",
ADD COLUMN     "funcaoId" TEXT NOT NULL;

-- DropTable
DROP TABLE "vagas_evento";

-- CreateIndex
CREATE UNIQUE INDEX "alocacoes_escalaId_membroId_funcaoId_key" ON "alocacoes"("escalaId", "membroId", "funcaoId");

-- AddForeignKey
ALTER TABLE "alocacoes" ADD CONSTRAINT "alocacoes_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "funcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

