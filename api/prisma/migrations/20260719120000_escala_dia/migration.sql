-- Escala.dia: fixa a qual DIA do evento a escala se refere (multi-dia). O unique
-- passa a incluir o dia, permitindo uma escala padrão por dia do evento.

-- 1) Nova coluna date-only, nullable.
ALTER TABLE "escalas" ADD COLUMN "dia" DATE;

-- 2) Backfill: escalas existentes recebem o dia (data) do início do seu evento.
UPDATE "escalas" AS e
SET "dia" = ev."inicio"::date
FROM "eventos" AS ev
WHERE ev."id" = e."eventoId";

-- 3) Troca o unique (ministerioId, eventoId, nome) por (ministerioId, eventoId, dia, nome).
DROP INDEX "escalas_ministerioId_eventoId_nome_key";
CREATE UNIQUE INDEX "escalas_ministerioId_eventoId_dia_nome_key" ON "escalas"("ministerioId", "eventoId", "dia", "nome");
