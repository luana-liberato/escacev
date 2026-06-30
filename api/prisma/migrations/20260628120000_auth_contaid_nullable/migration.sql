-- Convite pendente: um Membro pode existir sem Conta vinculada até o primeiro
-- login com Google. Torna membros.contaId opcional (NULL = convite pendente).
ALTER TABLE "membros" ALTER COLUMN "contaId" DROP NOT NULL;
