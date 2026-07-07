-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "reputacaoPrestador" REAL NOT NULL DEFAULT 5.0,
    "totalAvaliacoesPrestador" INTEGER NOT NULL DEFAULT 1,
    "reputacaoCliente" REAL NOT NULL DEFAULT 5.0,
    "totalAvaliacoesCliente" INTEGER NOT NULL DEFAULT 1,
    "totalServicosConcluidos" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Competencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "Competencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Habilidade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    CONSTRAINT "Habilidade_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Demanda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorEstimado" REAL,
    "valorFinalAcordado" REAL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "categoriaId" INTEGER NOT NULL,
    "habilidadesExtras" TEXT NOT NULL DEFAULT '',
    "prazoFinalizacao" DATETIME NOT NULL,
    "nivelMinimoExigido" TEXT NOT NULL DEFAULT 'INICIANTE',
    "reputacaoMinimaExigida" REAL NOT NULL DEFAULT 0,
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataUltimaAtualizacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAprovacao" DATETIME,
    "dataEntregaPrestador" DATETIME,
    "prestadorConcluiuEm" DATETIME,
    "clienteAvaliouEm" DATETIME,
    "notaPrestadorParaCliente" REAL,
    "notaClienteParaPrestador" REAL,
    "contratanteId" TEXT NOT NULL,
    "prestadorEscolhidoId" TEXT,
    CONSTRAINT "Demanda_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Demanda_contratanteId_fkey" FOREIGN KEY ("contratanteId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Demanda_prestadorEscolhidoId_fkey" FOREIGN KEY ("prestadorEscolhidoId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demandaId" TEXT NOT NULL,
    "prestadorId" TEXT NOT NULL,
    "valorProposto" REAL NOT NULL,
    "mensagem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "ultimaPropostaPor" TEXT NOT NULL DEFAULT 'PRESTADOR',
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAtualizacao" DATETIME NOT NULL,
    CONSTRAINT "Orcamento_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Orcamento_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Competencia_usuarioId_nome_key" ON "Competencia"("usuarioId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Habilidade_categoriaId_nome_key" ON "Habilidade"("categoriaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_demandaId_prestadorId_key" ON "Orcamento"("demandaId", "prestadorId");
