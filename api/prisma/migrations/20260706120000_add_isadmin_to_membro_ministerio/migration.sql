-- Papel de administrador escopado por ministério (Seção 1 do CLAUDE.md):
-- isAdmin = true significa que o membro, além de participar, também administra
-- este ministério. Coluna aditiva com default false — vínculos existentes
-- permanecem como participantes não-admins.
ALTER TABLE "membros_ministerios" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
