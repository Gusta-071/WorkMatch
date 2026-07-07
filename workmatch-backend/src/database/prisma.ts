/**
 * Configuração e instância do Prisma Client.
 * Responsável por conectar a aplicação ao banco de dados SQLite (via LibSQL)
 * e disponibilizar o client do Prisma para uso em toda a aplicação.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// Monta o caminho do banco local apenas quando necessário (evita calcular
// __dirname, que não existe em módulos ES — usamos import.meta.url no lugar).
function caminhoBancoLocal(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return `file:${path.join(__dirname, '..', 'prisma', 'dev.db')}`;
}

// Caminho do banco de dados: usa a variável de ambiente DATABASE_URL se
// definida, ou monta um caminho relativo ao projeto como fallback.
const databaseUrl = process.env.DATABASE_URL ?? caminhoBancoLocal();

// Em produção (com Turso configurado), conecta no banco remoto usando a
// URL e o token de autenticação. Em desenvolvimento, essas variáveis não
// existem e o adapter usa apenas o arquivo SQLite local (authToken undefined).
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Instância única do Prisma Client, utilizando o adapter configurado acima.
export const prisma = new PrismaClient({ adapter });