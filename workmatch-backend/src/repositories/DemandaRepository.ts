/**
 * Repositório de Demanda.
 * Responsável pela persistência das demandas, pelas consultas usadas nas
 * diferentes abas do app (Solicitações, Explorar, Serviços) e pela
 * reconstrução segura do objeto de domínio a partir dos dados do banco.
 */

import { prisma } from '../database/prisma';
import { Demanda, StatusDemanda } from '../domain/Demanda';
import { Usuario } from '../domain/Usuario';
import { NivelExperiencia } from '../domain/NivelExperiencia';

export class DemandaRepository {

  // Salva uma nova demanda no banco.
  async salvar(demanda: Demanda): Promise<void> {
    await prisma.demanda.create({
      data: {
        id: demanda.id,
        titulo: demanda.titulo,
        descricao: demanda.descricao,
        valorEstimado: demanda.valorEstimado,
        valorFinalAcordado: demanda.valorFinalAcordado,
        status: demanda.status,
        habilidadesExtras: demanda.habilidadesExtras.join(','),
        prazoFinalizacao: demanda.prazoFinalizacao,
        nivelMinimoExigido: demanda.nivelMinimoExigido,
        reputacaoMinimaExigida: demanda.reputacaoMinimaExigida,
        dataCriacao: demanda.dataCriacao,
        dataUltimaAtualizacao: demanda.dataUltimaAtualizacao,
        categoria: { connect: { id: demanda.categoriaId } },
        contratante: { connect: { id: demanda.contratante.id } },
        ...(demanda.prestadorEscolhido
          ? { prestadorEscolhido: { connect: { id: demanda.prestadorEscolhido.id } } }
          : {}),
      },
    });
  }

  // Busca uma demanda por ID e reconstrói o objeto de domínio.
  async buscarPorId(id: string): Promise<Demanda | null> {
    const dados = await prisma.demanda.findUnique({
      where: { id },
      include: {
        contratante: { include: { competencias: true } },
        prestadorEscolhido: { include: { competencias: true } },
        categoria: true
      },
    });

    if (!dados) return null;
    return this.reconstituir(dados);
  }

  // Lista todas as demandas não excluídas (painéis e fluxos gerais).
  async listarTodas(): Promise<object[]> {
    const lista = await prisma.demanda.findMany({
      where: { status: { not: 'EXCLUIDA' } },
      include: { contratante: true, prestadorEscolhido: true, categoria: true },
      orderBy: { dataCriacao: 'desc' },
    });
    return lista.map(d => this.paraResumo(d));
  }

  // Lista as demandas criadas por um contratante (aba "Solicitações").
  async listarPorContratante(contratanteId: string): Promise<object[]> {
    const lista = await prisma.demanda.findMany({
      where: { contratanteId },
      include: { contratante: true, prestadorEscolhido: true, categoria: true },
      orderBy: { dataCriacao: 'desc' },
    });
    return lista.map(d => this.paraResumo(d));
  }

  // Lista demandas abertas/em negociação no mercado, excluindo as do próprio
  // usuário e as que já possuem orçamento ativo dele (aba "Explorar").
  async listarAbertasParaExplorar(excetoContratanteId: string): Promise<object[]> {
    const lista = await prisma.demanda.findMany({
      where: {
        status: { in: ['ABERTA', 'NEGOCIACAO'] },
        contratanteId: { not: excetoContratanteId },
        orcamentos: {
          none: {
            prestadorId: excetoContratanteId,
            status: { not: 'RECUSADO' },
          },
        },
      },
      include: { contratante: true, prestadorEscolhido: true, categoria: true },
      orderBy: { dataCriacao: 'desc' },
    });
    return lista.map(d => this.paraResumo(d));
  }

  // Lista demandas em andamento/concluídas nas quais o usuário é o prestador
  // escolhido (aba "Serviços").
  async listarServicos(usuarioId: string): Promise<object[]> {
    const lista = await prisma.demanda.findMany({
      where: {
        status: { in: ['APROVADA', 'CONCLUIDA'] },
        prestadorEscolhidoId: usuarioId,
      },
      include: { contratante: true, prestadorEscolhido: true, categoria: true },
      orderBy: { dataAprovacao: 'desc' },
    });
    return lista.map(d => ({
      ...this.paraResumo(d),
      papelDoUsuario: 'PRESTADOR' as const,
      dataAprovacao: d.dataAprovacao,
      dataEntregaPrestador: d.dataEntregaPrestador,
      prestadorConcluiuEm: d.prestadorConcluiuEm,
      clienteAvaliouEm: d.clienteAvaliouEm,
      notaPrestadorParaCliente: d.notaPrestadorParaCliente,
      notaClienteParaPrestador: d.notaClienteParaPrestador,
    }));
  }

  // Calcula as habilidades mais recorrentes entre as demandas ativas no
  // mercado, para exibir como sugestões/tendências.
  async getHabilidadesMaisBuscadas(limit: number = 8): Promise<string[]> {
    try {
      // Busca as habilidades de todas as demandas ativas/disponíveis.
      const demandas = await prisma.demanda.findMany({
        where: {
          status: { in: ['ABERTA', 'NEGOCIACAO'] },
        },
        select: {
          habilidadesExtras: true,
        },
      });

      const contagemMap: Record<string, number> = {};

      // Separa as strings de cada demanda e conta a recorrência de cada habilidade.
      for (const d of demandas) {
        if (!d.habilidadesExtras) continue;

        const habilidades = d.habilidadesExtras.split(',').map(h => h.trim()).filter(Boolean);

        for (const hab of habilidades) {
          contagemMap[hab] = (contagemMap[hab] || 0) + 1;
        }
      }

      // Ordena pela recorrência (decrescente) e aplica o limite solicitado.
      const habilidadesOrdenadas = Object.entries(contagemMap)
        .sort((a, b) => b[1] - a[1])
        .map(([nome]) => nome)
        .slice(0, limit);

      return habilidadesOrdenadas;
    } catch (error) {
      console.error('Erro ao mapear habilidades mais buscadas no repositório:', error);
      throw error;
    }
  }

  // Formata os dados da demanda em um DTO enxuto para o front-end.
  private paraResumo(d: any): object {
    const taxaPorNivel: Record<string, number> = { INICIANTE: 0, INTERMEDIARIO: 0.05, AVANCADO: 0.10, ESPECIALISTA: 0.20 };
    return {
      id: d.id,
      titulo: d.titulo,
      descricao: d.descricao,
      valorEstimado: d.valorEstimado,
      valorComTaxa: d.valorEstimado != null ? d.valorEstimado * (1 + (taxaPorNivel[d.nivelMinimoExigido] ?? 0)) : null,
      valorFinalAcordado: d.valorFinalAcordado,
      status: d.status,
      categoria: { id: d.categoria.id, nome: d.categoria.nome },
      habilidadesExtras: d.habilidadesExtras ? d.habilidadesExtras.split(',').filter(Boolean) : [],
      prazoFinalizacao: d.prazoFinalizacao,
      nivelMinimoExigido: d.nivelMinimoExigido,
      reputacaoMinimaExigida: d.reputacaoMinimaExigida,
      dataCriacao: d.dataCriacao,
      dataUltimaAtualizacao: d.dataUltimaAtualizacao,
      contratante: { id: d.contratante.id, nome: d.contratante.nome, reputacaoCliente: d.contratante.reputacaoCliente },
      prestadorEscolhido: d.prestadorEscolhido ? { id: d.prestadorEscolhido.id, nome: d.prestadorEscolhido.nome } : null,
      dataAprovacao: d.dataAprovacao,
      dataEntregaPrestador: d.dataEntregaPrestador,
      prestadorConcluiuEm: d.prestadorConcluiuEm,
      notaPrestadorParaCliente: d.notaPrestadorParaCliente,
      notaClienteParaPrestador: d.notaClienteParaPrestador,
    };
  }

  // Atualiza as propriedades controladas e o status de uma demanda existente.
  async atualizar(demanda: Demanda): Promise<void> {
    await prisma.demanda.update({
      where: { id: demanda.id },
      data: {
        status: demanda.status,
        valorFinalAcordado: demanda.valorFinalAcordado,
        dataUltimaAtualizacao: demanda.dataUltimaAtualizacao,
        dataAprovacao: demanda.dataAprovacao,
        dataEntregaPrestador: demanda.dataEntregaPrestador,
        prestadorConcluiuEm: demanda.prestadorConcluiuEm,
        clienteAvaliouEm: demanda.clienteAvaliouEm,
        notaPrestadorParaCliente: demanda.notaPrestadorParaCliente,
        notaClienteParaPrestador: demanda.notaClienteParaPrestador,
        prestadorEscolhidoId: demanda.prestadorEscolhido?.id ?? null,
      },
    });
  }

  // Reconstrói a Demanda e seus usuários relacionados (contratante e
  // prestador escolhido) a partir dos dados retornados pelo Prisma.
  private reconstituir(dados: any): Demanda {
    // Reconstrói o contratante.
    const contratante = Usuario.reconstituir({
      id: dados.contratante.id,
      nome: dados.contratante.nome,
      email: dados.contratante.email,
      senha: dados.contratante.senha,
      reputacaoPrestador: dados.contratante.reputacaoPrestador ?? 5.0,
      totalAvaliacoesPrestador: dados.contratante.totalAvaliacoesPrestador ?? 1,
      reputacaoCliente: dados.contratante.reputacaoCliente ?? 5.0,
      totalAvaliacoesCliente: dados.contratante.totalAvaliacoesCliente ?? 1,
      totalServicosConcluidos: dados.contratante.totalServicosConcluidos ?? 0,
      competencias: dados.contratante.competencias ? dados.contratante.competencias.map((c: any) => c.nome) : [],
    });

    // Reconstrói o prestador escolhido, se houver.
    let prestadorEscolhido: Usuario | null = null;
    if (dados.prestadorEscolhido) {
      prestadorEscolhido = Usuario.reconstituir({
        id: dados.prestadorEscolhido.id,
        nome: dados.prestadorEscolhido.nome,
        email: dados.prestadorEscolhido.email,
        senha: dados.prestadorEscolhido.senha,
        reputacaoPrestador: dados.prestadorEscolhido.reputacaoPrestador ?? 5.0,
        totalAvaliacoesPrestador: dados.prestadorEscolhido.totalAvaliacoesPrestador ?? 1,
        reputacaoCliente: dados.prestadorEscolhido.reputacaoCliente ?? 5.0,
        totalAvaliacoesCliente: dados.prestadorEscolhido.totalAvaliacoesCliente ?? 1,
        totalServicosConcluidos: dados.prestadorEscolhido.totalServicosConcluidos ?? 0,
        competencias: dados.prestadorEscolhido.competencias ? dados.prestadorEscolhido.competencias.map((c: any) => c.nome) : [],
      });
    }

    const habilidadesExtras = dados.habilidadesExtras
      ? dados.habilidadesExtras.split(',').filter(Boolean)
      : [];

    // Retorna a Demanda reconstituída, respeitando o encapsulamento da entidade.
    return Demanda.reconstituir({
      id: dados.id,
      contratante,
      prestadorEscolhido,
      titulo: dados.titulo,
      descricao: dados.descricao,
      valorEstimado: dados.valorEstimado,
      valorFinalAcordado: dados.valorFinalAcordado,
      status: dados.status as StatusDemanda,
      categoriaId: dados.categoriaId,
      habilidadesExtras,
      prazoFinalizacao: dados.prazoFinalizacao,
      nivelMinimoExigido: dados.nivelMinimoExigido as NivelExperiencia,
      reputacaoMinimaExigida: dados.reputacaoMinimaExigida,
      dataCriacao: dados.dataCriacao,
      dataUltimaAtualizacao: dados.dataUltimaAtualizacao,
      dataAprovacao: dados.dataAprovacao,
      dataEntregaPrestador: dados.dataEntregaPrestador,
      prestadorConcluiuEm: dados.prestadorConcluiuEm,
      clienteAvaliouEm: dados.clienteAvaliouEm,
      notaPrestadorParaCliente: dados.notaPrestadorParaCliente,
      notaClienteParaPrestador: dados.notaClienteParaPrestador,
    });
  }
}