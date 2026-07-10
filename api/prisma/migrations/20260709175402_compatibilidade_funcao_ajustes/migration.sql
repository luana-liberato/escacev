-- AlterTable
ALTER TABLE "compatibilidade_funcoes" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "compatibilidade_funcoes_funcaoBId_idx" ON "compatibilidade_funcoes"("funcaoBId");
