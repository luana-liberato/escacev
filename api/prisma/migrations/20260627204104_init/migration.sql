-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN_GERAL', 'ADMIN_MINISTERIO', 'MEMBRO');

-- CreateEnum
CREATE TYPE "StatusEscala" AS ENUM ('RASCUNHO', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "StatusTroca" AS ENUM ('PENDENTE', 'ACEITA', 'REJEITADA', 'CONFIRMADA');

-- CreateTable
CREATE TABLE "instituicoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "logoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instituicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nomeExibido" TEXT,
    "fotoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "instituicaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'MEMBRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ministerios" (
    "id" TEXT NOT NULL,
    "instituicaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ministerios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcoes" (
    "id" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibilidade_funcoes" (
    "id" TEXT NOT NULL,
    "funcaoAId" TEXT NOT NULL,
    "funcaoBId" TEXT NOT NULL,

    CONSTRAINT "compatibilidade_funcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros_ministerios" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membros_ministerios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "instituicaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas_evento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vagas_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas" (
    "id" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "status" "StatusEscala" NOT NULL DEFAULT 'RASCUNHO',
    "publicadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alocacoes" (
    "id" TEXT NOT NULL,
    "escalaId" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "conflito" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alocacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indisponibilidades" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indisponibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trocas" (
    "id" TEXT NOT NULL,
    "proponenteId" TEXT NOT NULL,
    "alvoId" TEXT,
    "alocacaoOrigemId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" "StatusTroca" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trocas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_googleSub_key" ON "contas"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "contas_email_key" ON "contas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "membros_contaId_instituicaoId_key" ON "membros"("contaId", "instituicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "compatibilidade_funcoes_funcaoAId_funcaoBId_key" ON "compatibilidade_funcoes"("funcaoAId", "funcaoBId");

-- CreateIndex
CREATE UNIQUE INDEX "membros_ministerios_membroId_ministerioId_key" ON "membros_ministerios"("membroId", "ministerioId");

-- CreateIndex
CREATE UNIQUE INDEX "vagas_evento_eventoId_funcaoId_key" ON "vagas_evento"("eventoId", "funcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "escalas_ministerioId_eventoId_key" ON "escalas"("ministerioId", "eventoId");

-- CreateIndex
CREATE INDEX "alocacoes_membroId_idx" ON "alocacoes"("membroId");

-- CreateIndex
CREATE UNIQUE INDEX "alocacoes_escalaId_vagaId_membroId_key" ON "alocacoes"("escalaId", "vagaId", "membroId");

-- CreateIndex
CREATE INDEX "indisponibilidades_membroId_inicio_fim_idx" ON "indisponibilidades"("membroId", "inicio", "fim");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministerios" ADD CONSTRAINT "ministerios_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcoes" ADD CONSTRAINT "funcoes_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidade_funcoes" ADD CONSTRAINT "compatibilidade_funcoes_funcaoAId_fkey" FOREIGN KEY ("funcaoAId") REFERENCES "funcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidade_funcoes" ADD CONSTRAINT "compatibilidade_funcoes_funcaoBId_fkey" FOREIGN KEY ("funcaoBId") REFERENCES "funcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_ministerios" ADD CONSTRAINT "membros_ministerios_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_ministerios" ADD CONSTRAINT "membros_ministerios_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas_evento" ADD CONSTRAINT "vagas_evento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas_evento" ADD CONSTRAINT "vagas_evento_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "funcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes" ADD CONSTRAINT "alocacoes_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "escalas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes" ADD CONSTRAINT "alocacoes_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas_evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes" ADD CONSTRAINT "alocacoes_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indisponibilidades" ADD CONSTRAINT "indisponibilidades_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas" ADD CONSTRAINT "trocas_proponenteId_fkey" FOREIGN KEY ("proponenteId") REFERENCES "membros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas" ADD CONSTRAINT "trocas_alvoId_fkey" FOREIGN KEY ("alvoId") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas" ADD CONSTRAINT "trocas_alocacaoOrigemId_fkey" FOREIGN KEY ("alocacaoOrigemId") REFERENCES "alocacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
