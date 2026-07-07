/**
 * Repositório de Orcamento.
 * Responsável pela persistência das propostas de orçamento, pelas consultas
 * usadas nas visões de cliente e prestador, e pela reconstrução segura do
 * objeto de domínio (incluindo a Demanda e os Usuarios relacionados).
 */

import { prisma } from '../database/prisma';
import { Orcamento, StatusOrcamento, AutorProposta } from '../domain/Orcamento';
import { Demanda, StatusDemanda } from '../domain/Demanda';
import { Usuario } from '../domain/Usuario';
import { NivelExperiencia } from '../domain/NivelExperiencia';

const MENSAGEM_RECUSA_AUTOMATICA = "Outro orçamento foi aceito para esta demanda.";
const MENSAGEM_RECUSA_POR_CANCELAMENTO = "O cliente desativou esta demanda.";

export class OrcamentoRepository {

  // Salva um novo orçamento no banco.
  async salvar(orcamento: Orcamento): Promise<void> {
    await prisma.orcamento.create({
      data: {
        id: orcamento.id,
        demandaId: orcamento.demanda.id,
        prestadorId: orcamento.prestador.id,
        valorProposto: orcamento.valorProposto,
        mensagem: orcamento.mensagem,
        status: orcamento.status,
        ultimaPropostaPor: orcamento.ultimaPropostaPor,
        dataCriacao: orcamento.dataCriacao,
        dataAtualizacao: orcamento.dataAtualizacao,
      },
    });
  }

  // Busca um orçamento pelo ID e reconstrói o objeto de domínio completo.
  async buscarPorId(id: string): Promise<Orcamento | null> {
    const dados = await prisma.orcamento.findUnique({
      where: { id },
      include: {
        demanda: {
          include: {
            contratante: { include: { competencias: true } },
            prestadorEscolhido: { include: { competencias: true } },
            categoria: true
          }
        },
        prestador: { include: { competencias: true } }
      },
    });

    if (!dados) return null;
    return this.reconstituir(dados);
  }

  // Busca o orçamento de um prestador específico para uma demanda específica.
  async buscarPorDemandaEPrestador(demandaId: string, prestadorId: string): Promise<Orcamento | null> {
    const dados = await prisma.orcamento.findFirst({
      where: { demandaId, prestadorId },
      include: {
        demanda: {
          include: {
            contratante: { include: { competencias: true } },
            prestadorEscolhido: { include: { competencias: true } },
            categoria: true
          }
        },
        prestador: { include: { competencias: true } }
      },
    });

    if (!dados) return null;
    return this.reconstituir(dados);
  }

  // Lista os orçamentos recebidos por uma demanda (visão do cliente/contratante).
  async listarPorDemanda(demandaId: string): Promise<object[]> {
    const lista = await prisma.orcamento.findMany({
      where: { demandaId, status: { not: 'EXCLUIDO' } },
      include: { prestador: true },
      orderBy: { dataAtualizacao: 'desc' },
    });

    return lista.map(o => ({
      id: o.id,
      valorProposto: o.valorProposto,
      mensagem: o.mensagem,
      status: o.status,
      ultimaPropostaPor: o.ultimaPropostaPor,
      dataAtualizacao: o.dataAtualizacao,
      prestador: {
        id: o.prestador.id,
        nome: o.prestador.nome,
        reputacaoPrestador: o.prestador.reputacaoPrestador,
        totalServicosConcluidos: o.prestador.totalServicosConcluidos,
      },
    }));
  }

  // Lista as propostas feitas por um prestador (aba "Propostas").
  async listarPorPrestador(prestadorId: string): Promise<object[]> {
    const lista = await prisma.orcamento.findMany({
      where: { prestadorId, status: { not: 'EXCLUIDO' } },
      include: { demanda: { include: { categoria: true } } },
      orderBy: { dataAtualizacao: 'desc' },
    });

    return lista.map(o => ({
      id: o.id,
      valorProposto: o.valorProposto,
      status: o.status,
      ultimaPropostaPor: o.ultimaPropostaPor,
      dataAtualizacao: o.dataAtualizacao,
      demanda: {
        id: o.demanda.id,
        titulo: o.demanda.titulo,
        status: o.demanda.status,
        categoria: o.demanda.categoria.nome,
      },
    }));
  }

  // Recusa automaticamente todos os demais orçamentos pendentes de uma
  // demanda quando um deles é aceito.
  async recusarTodosOutrosPendentes(demandaId: string, excetoOrcamentoId: string): Promise<void> {
    await prisma.orcamento.updateMany({
      where: {
        demandaId,
        id: { not: excetoOrcamentoId },
        status: 'PENDENTE',
      },
      data: {
        status: 'RECUSADO',
        mensagem: MENSAGEM_RECUSA_AUTOMATICA,
        ultimaPropostaPor: 'CLIENTE',
        dataAtualizacao: new Date(),
      },
    });
  }

  // Recusa todos os orçamentos pendentes de uma demanda quando o cliente
  // cancela/desativa a demanda inteira.
  async recusarTodosPendentesPorCancelamento(demandaId: string): Promise<void> {
    await prisma.orcamento.updateMany({
      where: {
        demandaId,
        status: 'PENDENTE',
      },
      data: {
        status: 'RECUSADO',
        mensagem: MENSAGEM_RECUSA_POR_CANCELAMENTO,
        ultimaPropostaPor: 'CLIENTE',
        dataAtualizacao: new Date(),
      },
    });
  }

  // Atualiza os dados controlados de um orçamento existente.
  async atualizar(orcamento: Orcamento): Promise<void> {
    await prisma.orcamento.update({
      where: { id: orcamento.id },
      data: {
        valorProposto: orcamento.valorProposto,
        mensagem: orcamento.mensagem,
        status: orcamento.status,
        ultimaPropostaPor: orcamento.ultimaPropostaPor,
        dataAtualizacao: orcamento.dataAtualizacao,
      },
    });
  }

  // Reconstrói o Orcamento e todas as entidades relacionadas (Demanda,
  // contratante, prestador escolhido e prestador autor da proposta).
  private reconstituir(dados: any): Orcamento {
    // Reconstrói o contratante da demanda.
    const contratante = Usuario.reconstituir({
      id: dados.demanda.contratante.id,
      nome: dados.demanda.contratante.nome,
      email: dados.demanda.contratante.email,
      senha: dados.demanda.contratante.senha,
      reputacaoPrestador: dados.demanda.contratante.reputacaoPrestador ?? 5.0,
      totalAvaliacoesPrestador: dados.demanda.contratante.totalAvaliacoesPrestador ?? 1,
      reputacaoCliente: dados.demanda.contratante.reputacaoCliente ?? 5.0,
      totalAvaliacoesCliente: dados.demanda.contratante.totalAvaliacoesCliente ?? 1,
      totalServicosConcluidos: dados.demanda.contratante.totalServicosConcluidos ?? 0,
      competencias: dados.demanda.contratante.competencias ? dados.demanda.contratante.competencias.map((c: any) => c.nome) : [],
    });

    // Reconstrói o prestador escolhido da demanda, se houver.
    let prestadorEscolhido: Usuario | null = null;
    if (dados.demanda.prestadorEscolhido) {
      prestadorEscolhido = Usuario.reconstituir({
        id: dados.demanda.prestadorEscolhido.id,
        nome: dados.demanda.prestadorEscolhido.nome,
        email: dados.demanda.prestadorEscolhido.email,
        senha: dados.demanda.prestadorEscolhido.senha,
        reputacaoPrestador: dados.demanda.prestadorEscolhido.reputacaoPrestador ?? 5.0,
        totalAvaliacoesPrestador: dados.demanda.prestadorEscolhido.totalAvaliacoesPrestador ?? 1,
        reputacaoCliente: dados.demanda.prestadorEscolhido.reputacaoCliente ?? 5.0,
        totalAvaliacoesCliente: dados.demanda.prestadorEscolhido.totalAvaliacoesCliente ?? 1,
        totalServicosConcluidos: dados.demanda.prestadorEscolhido.totalServicosConcluidos ?? 0,
        competencias: dados.demanda.prestadorEscolhido.competencias ? dados.demanda.prestadorEscolhido.competencias.map((c: any) => c.nome) : [],
      });
    }

    const habilidadesExtras = dados.demanda.habilidadesExtras
      ? dados.demanda.habilidadesExtras.split(',').filter(Boolean)
      : [];

    // Reconstrói a Demanda vinculada ao orçamento.
    const demanda = Demanda.reconstituir({
      id: dados.demanda.id,
      contratante,
      prestadorEscolhido,
      titulo: dados.demanda.titulo,
      descricao: dados.demanda.descricao,
      valorEstimado: dados.demanda.valorEstimado,
      valorFinalAcordado: dados.demanda.valorFinalAcordado,
      status: dados.demanda.status as StatusDemanda,
      categoriaId: dados.demanda.categoriaId,
      habilidadesExtras,
      prazoFinalizacao: dados.demanda.prazoFinalizacao,
      nivelMinimoExigido: dados.demanda.nivelMinimoExigido as NivelExperiencia,
      reputacaoMinimaExigida: dados.demanda.reputacaoMinimaExigida,
      dataCriacao: dados.demanda.dataCriacao,
      dataUltimaAtualizacao: dados.demanda.dataUltimaAtualizacao,
      dataAprovacao: dados.demanda.dataAprovacao,
      dataEntregaPrestador: dados.demanda.dataEntregaPrestador,
      prestadorConcluiuEm: dados.demanda.prestadorConcluiuEm,
      clienteAvaliouEm: dados.demanda.clienteAvaliouEm,
      notaPrestadorParaCliente: dados.demanda.notaPrestadorParaCliente,
      notaClienteParaPrestador: dados.demanda.notaClienteParaPrestador,
    });

    // Reconstrói o prestador autor deste orçamento.
    const prestador = Usuario.reconstituir({
      id: dados.prestador.id,
      nome: dados.prestador.nome,
      email: dados.prestador.email,
      senha: dados.prestador.senha,
      reputacaoPrestador: dados.prestador.reputacaoPrestador ?? 5.0,
      totalAvaliacoesPrestador: dados.prestador.totalAvaliacoesPrestador ?? 1,
      reputacaoCliente: dados.prestador.reputacaoCliente ?? 5.0,
      totalAvaliacoesCliente: dados.prestador.totalAvaliacoesCliente ?? 1,
      totalServicosConcluidos: dados.prestador.totalServicosConcluidos ?? 0,
      competencias: dados.prestador.competencias ? dados.prestador.competencias.map((c: any) => c.nome) : [],
    });

    // Retorna o Orçamento totalmente reconstituído.
    return Orcamento.reconstituir({
      id: dados.id,
      demanda,
      prestador,
      valorProposto: dados.valorProposto,
      mensagem: dados.mensagem,
      status: dados.status as StatusOrcamento,
      ultimaPropostaPor: dados.ultimaPropostaPor as AutorProposta,
      dataCriacao: dados.dataCriacao,
      dataAtualizacao: dados.dataAtualizacao,
    });
  }
}