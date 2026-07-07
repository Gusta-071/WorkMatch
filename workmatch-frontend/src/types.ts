/**
 * types.ts
 *
 * Tipos, enums e interfaces compartilhados pelo domínio da aplicação:
 * níveis de experiência, status de demandas/orçamentos e as entidades
 * principais (Demanda, Orçamento, Usuário).
 */

// ─── Nível de experiência ───────────────────────────────────────────────────

export type NivelExperiencia = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO' | 'ESPECIALISTA';

/** Taxa aplicada sobre o valor da demanda, conforme o nível mínimo exigido. */
export const TAXA_POR_NIVEL: Record<NivelExperiencia, number> = {
  INICIANTE: 0,
  INTERMEDIARIO: 0.05,
  AVANCADO: 0.10,
  ESPECIALISTA: 0.20,
};

/** Rótulo em português exibido para cada nível de experiência. */
export const LABEL_NIVEL: Record<NivelExperiencia, string> = {
  INICIANTE: 'Iniciante',
  INTERMEDIARIO: 'Intermediário',
  AVANCADO: 'Avançado',
  ESPECIALISTA: 'Especialista',
};

// ─── Status ─────────────────────────────────────────────────────────────────

export type StatusDemanda =
  | 'ABERTA'
  | 'NEGOCIACAO'
  | 'APROVADA'
  | 'CONCLUIDA'
  | 'DESABILITADA'
  | 'EXCLUIDA';

export type StatusOrcamento = 'PENDENTE' | 'ACEITO' | 'RECUSADO' | 'EXCLUIDO';

/** Indica qual das partes (prestador ou cliente) fez a última proposta de valor. */
export type AutorProposta = 'PRESTADOR' | 'CLIENTE';

// ─── Entidades ──────────────────────────────────────────────────────────────

/** Dados resumidos de um usuário, usados em referências dentro de outras entidades. */
export interface UsuarioResumo {
  id: string;
  nome: string;
  reputacaoPrestador?: number;
  reputacaoCliente?: number;
}

export interface Categoria {
  id: number;
  nome: string;
  habilidades: { id: number; nome: string }[];
}

/** Uma solicitação de serviço criada por um cliente. */
export interface Demanda {
  id: string;
  titulo: string;
  descricao: string;
  valorEstimado: number | null;
  valorComTaxa: number | null;
  valorFinalAcordado: number;
  status: StatusDemanda;
  categoria: { id: number; nome: string };
  habilidadesExtras: string[];
  prazoFinalizacao: string;
  nivelMinimoExigido: NivelExperiencia;
  reputacaoMinimaExigida: number;
  dataCriacao: string;
  dataUltimaAtualizacao: string;
  contratante: UsuarioResumo;
  prestadorEscolhido: UsuarioResumo | null;
  dataAprovacao: string | null;
  dataEntregaPrestador: string | null;
  prestadorConcluiuEm: string | null;
  notaPrestadorParaCliente: number | null;
  notaClienteParaPrestador: number | null;
  matchScore?: number;
}

/** Uma demanda já aprovada/concluída, do ponto de vista de quem está prestando ou contratando o serviço. */
export interface DemandaServico extends Demanda {
  papelDoUsuario: 'CONTRATANTE' | 'PRESTADOR';
  dataAprovacao: string | null;
  dataEntregaPrestador: string | null;
  prestadorConcluiuEm: string | null;
  clienteAvaliouEm: string | null;
  notaPrestadorParaCliente: number | null;
  notaClienteParaPrestador: number | null;
}

/** Uma proposta de valor enviada por um prestador para uma demanda. */
export interface Orcamento {
  id: string;
  valorProposto: number;
  mensagem: string | null;
  status: StatusOrcamento;
  ultimaPropostaPor: AutorProposta;
  prestador?: UsuarioResumo;
  dataCriacao?: string;
  dataAtualizacao?: string;
  demanda?: { id: string; titulo: string; status: StatusDemanda; categoria: string };
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  reputacaoPrestador: number;
  reputacaoCliente: number;
  totalServicosConcluidos: number;
  nivelExperiencia: NivelExperiencia;
  competencias: string[];
}

// ─── Agrupamentos de status ─────────────────────────────────────────────────

export const STATUS_ATIVOS: StatusDemanda[] = ['ABERTA', 'NEGOCIACAO', 'APROVADA'];
export const STATUS_HISTORICO: StatusDemanda[] = ['CONCLUIDA', 'DESABILITADA', 'EXCLUIDA'];