import { prisma } from '../database/prisma';

export class CategoriaRepository {

  // Catálogo completo, pra montar a lista de seleção no perfil (habilidades) e na criação de demanda (categoria)
  async listarTodasComHabilidades(): Promise<object[]> {
    const categorias = await prisma.categoria.findMany({
      include: { habilidades: true },
      orderBy: { nome: 'asc' },
    });
    return categorias.map(c => ({
      id: c.id,
      nome: c.nome,
      habilidades: c.habilidades.map(h => ({ id: h.id, nome: h.nome })),
    }));
  }

  // Nomes das habilidades de uma categoria específica — usado pra calcular o match score de uma demanda
  async listarNomesHabilidadesPorCategoria(categoriaId: number): Promise<string[]> {
    const habilidades = await prisma.habilidade.findMany({ where: { categoriaId } });
    return habilidades.map(h => h.nome.toLowerCase());
  }

  async buscarPorId(id: number): Promise<{ id: number; nome: string } | null> {
    return prisma.categoria.findUnique({ where: { id } });
  }
}