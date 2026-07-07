/**
 * Configuração do Prisma CLI.
 * Define o caminho do schema, a fonte de dados usada pelas migrations
 * e o comando de seed executado após `prisma migrate reset`/`db seed`.
 */
 
import { defineConfig } from '@prisma/config';
 
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: 'file:./prisma/dev.db',
  },
  // Comando executado para popular o banco com dados iniciais.
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});