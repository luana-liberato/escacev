-- DropIndex
DROP INDEX "escalas_ministerioId_eventoId_key";

-- AlterTable
ALTER TABLE "escalas" ADD COLUMN     "nome" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "escalas_ministerioId_eventoId_nome_key" ON "escalas"("ministerioId", "eventoId", "nome");

