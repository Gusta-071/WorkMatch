/**
 * Aba "Solicitacoes"
 * Painel do cliente para gerenciar suas demandas (solicitações de serviço):
 * criação de novas demandas, acompanhamento de orçamentos recebidos,
 * negociação com prestadores, avaliação e histórico (concluídas/excluídas).
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api';
import { useSubpainelSidebar } from '../layouts/SubpainelContext';
import SubAbasPainel, { type ModoAbaPainel } from '../components/SubAbasPainel';
import type { Demanda, Orcamento, Categoria, NivelExperiencia, StatusDemanda } from '../types';
import { LABEL_NIVEL } from '../types';
import ModalAvaliacao from '../components/ModalAvaliacao';

// ─── Constantes ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StatusDemanda, string> = {
  ABERTA: 'Aberta',
  NEGOCIACAO: 'Em negociação',
  APROVADA: 'Aprovada',
  CONCLUIDA: 'Concluída',
  DESABILITADA: 'Desativada',
  EXCLUIDA: 'Excluída',
};

const STATUS_COR: Record<StatusDemanda, string> = {
  ABERTA: '#6b7280',
  NEGOCIACAO: '#f59e0b',
  APROVADA: '#22c55e',
  CONCLUIDA: '#22c55e',
  DESABILITADA: '#ef4444',
  EXCLUIDA: '#ef4444',
};

const NIVEIS: NivelExperiencia[] = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA'];
const TAXA: Record<NivelExperiencia, number> = { INICIANTE: 0, INTERMEDIARIO: 0.05, AVANCADO: 0.10, ESPECIALISTA: 0.20 };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Formata um número como moeda brasileira (R$). */
function brl(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Remove acentos e converte para minúsculo, para permitir busca textual tolerante. */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Formata uma data como "dd/mm/aaaa às hh:mm", ou "—" se nula/indefinida. */
function formatarDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const data = new Date(valor);
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataFormatada} às ${horaFormatada}`;
}

// ─── Formulário de nova demanda ─────────────────────────────────────────────

interface FormNovaDemandaProps {
  usuarioId: string;
  categorias: Categoria[];
  onCriada: () => void;
}

/**
 * Formulário de criação de uma nova demanda (solicitação de serviço).
 * Inclui autocomplete de habilidades extras (até 3), cálculo do valor com
 * taxa conforme o nível mínimo exigido, e publicação via API.
 */
function FormNovaDemanda({ usuarioId, categorias, onCriada }: FormNovaDemandaProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [nivel, setNivel] = useState<NivelExperiencia>('INICIANTE');
  const [reputacao, setReputacao] = useState(0);
  const [prazo, setPrazo] = useState('');
  const [buscaHabilidade, setBuscaHabilidade] = useState('');
  const [habilidadesSelecionadas, setHabilidadesSelecionadas] = useState<string[]>([]);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [infoCategoriaAberto, setInfoCategoriaAberto] = useState(false);
  const [categoriaHoverId, setCategoriaHoverId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const infoCategoriaRef = useRef<HTMLDivElement>(null);

  const valorNum = valor.trim() === '' ? null : Number(valor);
  const taxa = TAXA[nivel];
  const valorComTaxa = valorNum !== null ? valorNum * (1 + taxa) : null;

  /** Categoria sob o mouse na lista do popover de habilidades por categoria. */
  const categoriaHover = useMemo(
    () => categorias.find(c => String(c.id) === categoriaHoverId) ?? null,
    [categorias, categoriaHoverId]
  );

  /** Lista de habilidades disponíveis (ainda não selecionadas), filtrada pela busca. */
  const listaTodasHabilidadesFiltradas = useMemo(() => {
    const conjunto = new Set<string>();
    categorias.forEach(cat => {
      cat.habilidades?.forEach(h => {
        if (h.nome && !habilidadesSelecionadas.includes(h.nome)) {
          conjunto.add(h.nome);
        }
      });
    });

    const listaOrdenada = Array.from(conjunto).sort((a, b) => a.localeCompare(b));

    if (!buscaHabilidade.trim()) return listaOrdenada;

    const buscaNormalizada = normalizarTexto(buscaHabilidade);
    return listaOrdenada.filter(nome =>
      normalizarTexto(nome).includes(buscaNormalizada)
    );
  }, [categorias, buscaHabilidade, habilidadesSelecionadas]);

  // Fecha o dropdown de habilidades e o popover de info da categoria ao clicar fora.
  useEffect(() => {
    function cliqueFora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownAberto(false);
      }
      if (infoCategoriaRef.current && !infoCategoriaRef.current.contains(event.target as Node)) {
        setInfoCategoriaAberto(false);
      }
    }
    document.addEventListener('mousedown', cliqueFora);
    return () => document.removeEventListener('mousedown', cliqueFora);
  }, []);

  /** Adiciona uma habilidade à seleção, respeitando o limite de 3. */
  const adicionarHabilidade = (nome: string) => {
    if (habilidadesSelecionadas.length >= 3) return;
    setHabilidadesSelecionadas([...habilidadesSelecionadas, nome]);
    setBuscaHabilidade('');
    setDropdownAberto(false);
  };

  /** Remove uma habilidade previamente selecionada. */
  const removerHabilidade = (nome: string) => {
    setHabilidadesSelecionadas(habilidadesSelecionadas.filter(h => h !== nome));
  };

  /** Publica a nova demanda com os dados preenchidos no formulário. */
  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post('/demandas', {
        id: `dem_${Date.now()}`,
        contratanteId: usuarioId,
        titulo,
        descricao,
        valorEstimado: valorNum,
        categoriaId: Number(categoriaId),
        habilidadesExtras: habilidadesSelecionadas,
        prazoFinalizacao: new Date(prazo).toISOString(),
        nivelMinimoExigido: nivel,
        reputacaoMinimaExigida: reputacao,
      });
      onCriada();
    } catch (err: any) {
      setErro(err.response?.data?.error ?? 'Não foi possível criar a demanda.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={submeter} style={sf.form}>
      <div style={sf.grid2}>
        <div style={sf.campo}>
          <label style={sf.label}>Título</label>
          <input style={sf.input} value={titulo} onChange={e => setTitulo(e.target.value)} required />
        </div>
        <div style={sf.campo}>
          <label style={sf.label}>Categoria</label>
          <div style={sf.linhaCategoria}>
            <select style={{ ...sf.input, flex: 1 }} value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required>
              <option value="">Selecione...</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>

            <div ref={infoCategoriaRef} style={sf.wrapperInfo}>
              <button
                type="button"
                style={sf.btnInfo}
                onClick={() => setInfoCategoriaAberto(a => !a)}
                aria-label="Ver habilidades de cada categoria"
              >
                i
              </button>
              {infoCategoriaAberto && (
                <div style={sf.popoverInfo}>
                  <div style={sf.popoverListaCategorias}>
                    {categorias.map(c => (
                      <div
                        key={c.id}
                        style={{
                          ...sf.popoverItemCategoria,
                          ...(categoriaHoverId === String(c.id) ? sf.popoverItemCategoriaAtiva : {}),
                        }}
                        onMouseEnter={() => setCategoriaHoverId(String(c.id))}
                      >
                        {c.nome}
                      </div>
                    ))}
                  </div>
                  <div style={sf.popoverPainelHabilidades}>
                    {!categoriaHover ? (
                      <div style={sf.popoverVazio}>Passe o mouse sobre uma categoria para ver as habilidades dela.</div>
                    ) : categoriaHover.habilidades && categoriaHover.habilidades.length > 0 ? (
                      <>
                        <div style={sf.popoverTitulo}>{categoriaHover.nome}</div>
                        <div style={sf.popoverTags}>
                          {categoriaHover.habilidades.map(h => (
                            <span key={h.nome} style={sf.popoverTag}>{h.nome}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={sf.popoverVazio}>Esta categoria ainda não tem habilidades cadastradas.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={sf.campo}>
        <label style={sf.label}>Descrição</label>
        <textarea style={{ ...sf.input, minHeight: '80px', resize: 'vertical' }} value={descricao} onChange={e => setDescricao(e.target.value)} required />
      </div>

      <div style={sf.grid3}>
        <div style={sf.campo}>
          <label style={sf.label}>Valor estimado (R$)</label>
          <input style={sf.input} type="number" min={1} placeholder="Deixe em branco se não souber" value={valor} onChange={e => setValor(e.target.value)} />
        </div>
        <div style={sf.campo}>
          <label style={sf.label}>Nível mínimo</label>
          <select style={sf.input} value={nivel} onChange={e => setNivel(e.target.value as NivelExperiencia)}>
            {NIVEIS.map(n => <option key={n} value={n}>{LABEL_NIVEL[n]}</option>)}
          </select>
        </div>
        <div style={sf.campo}>
          <label style={sf.label}>Prazo</label>
          <input style={sf.input} type="date" value={prazo} onChange={e => setPrazo(e.target.value)} required />
        </div>
      </div>

      <div style={sf.grid2}>
        <div style={sf.campo}>
          <label style={sf.label}>Reputação mínima: {reputacao.toFixed(1)} Nota</label>
          <div style={sf.wrapperBarrinhaAlinhada}>
            <input style={sf.rangeInput} type="range" min={0} max={5} step={0.5} value={reputacao} onChange={e => setReputacao(Number(e.target.value))} />
          </div>
        </div>

        <div style={sf.campo}>
          <label style={sf.label}>Habilidades extras (Até 3 competências)</label>
          <div ref={containerRef} style={sf.wrapperAutocomplete}>
            <input
              type="text"
              placeholder={habilidadesSelecionadas.length >= 3 ? "Limite máximo de 3 atingido" : "Buscar e adicionar habilidades..."}
              value={buscaHabilidade}
              onChange={e => setBuscaHabilidade(e.target.value)}
              onFocus={() => setDropdownAberto(true)}
              disabled={habilidadesSelecionadas.length >= 3}
              style={sf.inputBusca}
            />

            {dropdownAberto && habilidadesSelecionadas.length < 3 && (
              <div style={sf.dropdownLista}>
                {listaTodasHabilidadesFiltradas.length === 0 ? (
                  <div style={sf.itemDropdownVazio}>Nenhuma habilidade disponível encontrada.</div>
                ) : (
                  listaTodasHabilidadesFiltradas.map(nome => (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => adicionarHabilidade(nome)}
                      style={sf.itemDropdownBotao}
                    >
                      {nome}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={sf.containerTags}>
            {habilidadesSelecionadas.map(nome => (
              <div key={nome} style={sf.tagItem}>
                <span>{nome}</span>
                <button type="button" onClick={() => removerHabilidade(nome)} style={sf.btnRemoverTag}>&times;</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {valorNum !== null && valorNum > 0 ? (
        <div style={sf.preview}>
          Valor com taxa ({(taxa * 100).toFixed(0)}%): <strong>{brl(valorComTaxa as number)}</strong>
        </div>
      ) : (
        <div style={sf.avisoValor}>
          Sem valor informado, sua solicitação vai aparecer como "A combinar" e prestadores não vão poder filtrá-la por faixa de preço no Explorar.
        </div>
      )}

      {erro && <p style={sf.erro}>{erro}</p>}

      <div style={sf.acoes}>
        <button style={sf.btnPrimario} disabled={enviando}>{enviando ? 'Criando...' : 'Publicar demanda'}</button>
      </div>
    </form>
  );
}

const sf: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  wrapperBarrinhaAlinhada: { height: '38px', display: 'flex', alignItems: 'center', width: '100%' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', height: '16px' },
  linhaCategoria: { display: 'flex', alignItems: 'stretch', gap: '6px' },
  wrapperInfo: { position: 'relative', display: 'flex', alignItems: 'stretch' },
  btnInfo: { width: '38px', minWidth: '38px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--code-bg)', color: 'var(--text)', fontSize: '13px', fontStyle: 'italic', fontWeight: 700, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  popoverInfo: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, display: 'flex', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', overflow: 'hidden' },
  popoverListaCategorias: { display: 'flex', flexDirection: 'column', minWidth: '150px', maxHeight: '240px', overflowY: 'auto', borderRight: '1px solid var(--border)' },
  popoverItemCategoria: { padding: '8px 12px', fontSize: '13px', color: 'var(--text-h)', whiteSpace: 'nowrap' },
  popoverItemCategoriaAtiva: { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 600 },
  popoverPainelHabilidades: { padding: '10px 12px', minWidth: '190px', maxWidth: '230px', display: 'flex', flexDirection: 'column', gap: '6px' },
  popoverTitulo: { fontSize: '11px', fontWeight: 700, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' },
  popoverTags: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  popoverTag: { fontSize: '11px', backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 },
  popoverVazio: { fontSize: '12px', color: 'var(--text)', fontStyle: 'italic' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: 'var(--bg)', color: 'var(--text-h)', width: '100%', boxSizing: 'border-box' },
  rangeInput: { width: '100%' },
  wrapperAutocomplete: { position: 'relative', width: '100%' },
  inputBusca: { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: 'var(--bg)', color: 'var(--text-h)', width: '100%', boxSizing: 'border-box' },
  dropdownLista: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  itemDropdownBotao: { width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-h)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'block' },
  itemDropdownVazio: { padding: '10px 12px', fontSize: '13px', color: 'var(--text)', fontStyle: 'italic' },
  containerTags: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', minHeight: '26px' },
  tagItem: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 },
  btnRemoverTag: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', padding: 0, display: 'flex', alignItems: 'center', fontWeight: 'bold' },
  preview: { fontSize: '13px', color: 'var(--text)', backgroundColor: 'var(--accent-bg)', padding: '10px 14px', borderRadius: '8px' },
  avisoValor: { fontSize: '13px', color: '#b45309', backgroundColor: '#fef3c7', padding: '10px 14px', borderRadius: '8px' },
  erro: { fontSize: '13px', color: '#ef4444' },
  acoes: { display: 'flex', justifyContent: 'flex-end', marginTop: '4px' },
  btnPrimario: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' },
};

// ─── Card de orçamento recebido ─────────────────────────────────────────────

interface CardOrcamentoProps {
  orc: Orcamento;
  onAceitar: () => void;
  onRecusar: () => void;
  onContrapropor: (novoValor: number, mensagem: string) => void;
}

/**
 * Card de um orçamento recebido de um prestador para uma demanda.
 * Permite ao cliente aceitar, recusar ou enviar uma contraproposta.
 */
function CardOrcamento({ orc, onAceitar, onRecusar, onContrapropor }: CardOrcamentoProps) {
  const [mostrando, setMostrando] = useState<'nada' | 'contra'>('nada');
  const [contraValor, setContraValor] = useState('');
  const [contraMensagem, setContraMensagem] = useState('');

  const corStatus: Record<string, string> = { PENDENTE: '#f59e0b', ACEITO: '#22c55e', RECUSADO: '#ef4444' };

  const aguardandoRespostaPrestador = orc.status === 'PENDENTE' && orc.ultimaPropostaPor === 'CLIENTE';

  return (
    <div style={co.card}>
      <div style={co.linha}>
        <div>
          <span style={co.nome}>{orc.prestador?.nome}</span>
          <span style={co.reputacao}> - Avaliação: {orc.prestador?.reputacaoPrestador.toFixed(1)}</span>
        </div>
        <div style={co.direita}>
          <span style={{ ...co.badge, backgroundColor: corStatus[orc.status] + '22', color: corStatus[orc.status] }}>
            {orc.status}
          </span>
          <span style={co.valor}>{brl(orc.valorProposto)}</span>
        </div>
      </div>

      {orc.mensagem && <p style={co.mensagem}>"{orc.mensagem}"</p>}

      {orc.status === 'PENDENTE' && mostrando === 'nada' && !aguardandoRespostaPrestador && (
        <div style={co.acoes}>
          <button style={co.btnAceitar} onClick={onAceitar}>Aceitar</button>
          <button style={co.btnContra} onClick={() => setMostrando('contra')}>Contrapropor</button>
          <button style={co.btnRecusar} onClick={onRecusar}>Recusar</button>
        </div>
      )}

      {aguardandoRespostaPrestador && mostrando === 'nada' && (
        <p style={co.aguardando}>Contraproposta enviada — aguardando resposta do prestador.</p>
      )}

      {mostrando === 'contra' && (
        <div style={co.formContra}>
          <input type="number" placeholder="Novo valor (R$)" value={contraValor} onChange={e => setContraValor(e.target.value)} style={co.inputContra} />
          <input placeholder="Mensagem (opcional)" value={contraMensagem} onChange={e => setContraMensagem(e.target.value)} style={co.inputContra} />
          <div style={co.acoes}>
            <button style={co.btnSecundario} onClick={() => setMostrando('nada')}>Cancelar</button>
            <button style={co.btnAceitar} onClick={() => {
              onContrapropor(Number(contraValor), contraMensagem);
              setMostrando('nada'); setContraValor(''); setContraMensagem('');
            }}>Enviar contraproposta</button>
          </div>
        </div>
      )}
    </div>
  );
}

const co: Record<string, React.CSSProperties> = {
  card: { backgroundColor: 'var(--code-bg)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  linha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: '14px', fontWeight: 600, color: 'var(--text-h)' },
  reputacao: { fontSize: '12px', color: 'var(--text)' },
  direita: { display: 'flex', alignItems: 'center', gap: '10px' },
  badge: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' },
  valor: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  mensagem: { fontSize: '13px', color: 'var(--text)', fontStyle: 'italic' },
  acoes: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnAceitar: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: '#22c55e22', color: '#16a34a' },
  btnContra: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: '#f59e0b22', color: '#b45309' },
  btnRecusar: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: '#ef444422', color: '#dc2626' },
  btnSecundario: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: 'var(--border)', color: 'var(--text-h)' },
  formContra: { display: 'flex', flexDirection: 'column', gap: '8px' },
  inputContra: { padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: 'var(--bg)', color: 'var(--text-h)' },
  aguardando: { fontSize: '13px', color: '#b45309', fontStyle: 'italic' },
};

// ─── Card de demanda (solicitação do cliente) ───────────────────────────────

interface CardDemandaProps {
  demanda: Demanda;
  onAtualizar: () => void;
}

/**
 * Card expansível de uma demanda do cliente. Mostra os dados da solicitação
 * e, quando aberto, carrega os orçamentos recebidos e permite desativar,
 * reativar, excluir a demanda ou avaliar o prestador ao final do serviço.
 */
function CardDemanda({ demanda, onAtualizar }: CardDemandaProps) {
  const [aberto, setAberto] = useState(false);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregandoOrcs, setCarregandoOrcs] = useState(false);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);

  // Referência usada para medir a altura real do conteúdo e animar a gaveta.
  const conteudoRef = useRef<HTMLDivElement>(null);

  /** Envia a nota de avaliação do cliente para o prestador escolhido. */
  const avaliarPrestador = async (nota: number) => {
    setEnviandoAvaliacao(true);
    try {
      await api.post(`/demandas/${demanda.id}/avaliar-prestador`, {
        contratanteId: demanda.contratante.id,
        nota,
      });
      setMostrarAvaliacao(false);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao avaliar.');
    } finally {
      setEnviandoAvaliacao(false);
    }
  };

  /** Busca os orçamentos recebidos para esta demanda. */
  const carregarOrcamentos = useCallback(async () => {
    setCarregandoOrcs(true);
    try {
      const res = await api.get(`/demandas/${demanda.id}/orcamentos`);
      setOrcamentos(res.data);
    } finally {
      setCarregandoOrcs(false);
    }
  }, [demanda.id]);

  // Carrega os orçamentos sob demanda, apenas quando o card é expandido.
  useEffect(() => {
    if (aberto) carregarOrcamentos();
  }, [aberto, carregarOrcamentos]);

  const podeDesativar = demanda.status === 'ABERTA' || demanda.status === 'NEGOCIACAO';
  const podeReativar = demanda.status === 'DESABILITADA';
  const podeExcluir = demanda.status === 'DESABILITADA';
  const cor = STATUS_COR[demanda.status as StatusDemanda] ?? '#9ca3af';

  /** Desativa a demanda, removendo-a do catálogo público. */
  const desativarDemanda = async () => {
    if (!confirm('Desativar esta demanda? Ela sairá do catálogo público.')) return;
    try {
      await api.post(`/demandas/${demanda.id}/cancelar`);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao desativar.');
    }
  };

  /** Reativa uma demanda previamente desativada, preservando o histórico. */
  const reativarDemanda = async () => {
    if (!confirm('Reativar esta demanda? Ela voltará a ficar visível no catálogo público, com todo o histórico preservado.')) return;
    try {
      await api.post(`/demandas/${demanda.id}/reativar`);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao reativar.');
    }
  };

  /** Exclui definitivamente a demanda, movendo-a para o histórico. */
  const excluirDemandaDefinitivo = async () => {
    if (!confirm('Tem certeza de que deseja excluir esta demanda? Ela será movida permanentemente para o histórico.')) return;
    try {
      await api.post(`/demandas/${demanda.id}/excluir`);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao excluir demanda.');
    }
  };

  /** Aceita um orçamento, recusando automaticamente os demais. */
  const aceitarOrc = async (id: string) => {
    if (!confirm('Aceitar este orçamento? Os demais serão recusados automaticamente.')) return;
    try {
      await api.post(`/orcamentos/${id}/aceitar`);
      await carregarOrcamentos();
      onAtualizar();
    } catch (err: any) { alert(err.response?.data?.error ?? 'Erro.'); }
  };

  /** Recusa um orçamento recebido. */
  const recusarOrc = async (id: string) => {
    try {
      await api.post(`/orcamentos/${id}/recusar`, { mensagem: null });
      await carregarOrcamentos();
      onAtualizar();
    } catch (err: any) { alert(err.response?.data?.error ?? 'Erro.'); }
  };

  /** Envia uma contraproposta do cliente para um orçamento recebido. */
  const contrapropor = async (id: string, novoValor: number, mensagem: string) => {
    try {
      await api.patch(`/orcamentos/${id}/contrapropor`, { autor: 'CLIENTE', novoValor, mensagem: mensagem || null });
      await carregarOrcamentos();
    } catch (err: any) { alert(err.response?.data?.error ?? 'Erro.'); }
  };

  return (
    <div style={cd.card}>
      <button style={cd.cabecalho} onClick={() => setAberto(!aberto)}>
        <div style={cd.esquerda}>
          <span style={cd.titulo}>{demanda.titulo}</span>
          <span style={cd.categoria}>
            {demanda.categoria.nome} 
            {demanda.status === 'CONCLUIDA' && demanda.dataUltimaAtualizacao && (
              <> • Concluído em: {formatarDataHora(demanda.dataUltimaAtualizacao)}</>
            )}
            {demanda.status === 'EXCLUIDA' && demanda.dataUltimaAtualizacao && (
              <> • Excluído em: {formatarDataHora(demanda.dataUltimaAtualizacao)}</>
            )}
            {demanda.status !== 'CONCLUIDA' && demanda.status !== 'EXCLUIDA' && (
              <> • Prazo: {new Date(demanda.prazoFinalizacao).toLocaleDateString('pt-BR')}</>
            )}
          </span>

          <span style={cd.meta}>Criada em: {formatarDataHora(demanda.dataCriacao)}</span>

          {demanda.status === 'APROVADA' && !demanda.dataEntregaPrestador && (
            <span style={cd.avisoAndamento}>Aguardando o prestador entregar o serviço.</span>
          )}

          {demanda.status === 'APROVADA' && demanda.dataEntregaPrestador && !demanda.prestadorConcluiuEm && (
            <span style={cd.avisoAndamento}>
              Serviço entregue em {formatarDataHora(demanda.dataEntregaPrestador)}. Aguardando o prestador avaliar você para liberar sua avaliação.
            </span>
          )}

          {demanda.status === 'APROVADA' && demanda.prestadorConcluiuEm && demanda.notaClienteParaPrestador === null && (
            <div style={cd.avisoAvaliacao}>
              <span>O prestador concluiu o serviço em {formatarDataHora(demanda.prestadorConcluiuEm)}. Avalie-o!</span>
              <button style={cd.btnCancelar} onClick={() => setMostrarAvaliacao(true)}>Avaliar prestador</button>
            </div>
          )}

          {demanda.status === 'APROVADA' && demanda.notaClienteParaPrestador !== null && (
            <span style={cd.avisoAndamento}>Você já avaliou. Aguardando avaliação do prestador para concluir.</span>
          )}

          {mostrarAvaliacao && (
            <ModalAvaliacao
              titulo="Avaliar o prestador"
              descricao={`Como foi sua experiência com ${demanda.prestadorEscolhido?.nome ?? 'o prestador'}?`}
              enviando={enviandoAvaliacao}
              aoFechar={() => setMostrarAvaliacao(false)}
              aoConfirmar={avaliarPrestador}
            />
          )}
        </div>
        <div style={cd.direita}>
          <span style={{ ...cd.statusBadge, backgroundColor: cor + '22', color: cor }}>
            {STATUS_LABEL[demanda.status as StatusDemanda]}
          </span>
          <span style={cd.valor}>
            {demanda.valorFinalAcordado > 0
              ? brl(demanda.valorFinalAcordado)
              : demanda.valorEstimado !== null
                ? brl(demanda.valorEstimado)
                : 'A combinar'}
          </span>
          {/* Seta indicadora do estado aberto/fechado do card */}
          <span style={{ 
            ...cd.chevron, 
            transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>▼</span>
        </div>
      </button>

      {/* Gaveta expansível: a altura é calculada dinamicamente a partir do conteúdo interno */}
      <div style={{
        ...cd.gavetaContainer,
        maxHeight: aberto ? `${conteudoRef.current?.scrollHeight}px` : '0px',
        opacity: aberto ? 1 : 0,
      }}>
        <div ref={conteudoRef} style={cd.corpo}>
          <p style={cd.descricao}>{demanda.descricao}</p>

          <div style={cd.grid}>
            {demanda.valorFinalAcordado > 0 ? (
              <span><strong>Valor final acordado:</strong> {brl(demanda.valorFinalAcordado)}</span>
            ) : (
              <span><strong>Valor estimado com taxa:</strong> {demanda.valorComTaxa !== null ? brl(demanda.valorComTaxa) : 'A combinar'}</span>
            )}
            <span><strong>Nível:</strong> {LABEL_NIVEL[demanda.nivelMinimoExigido]}</span>
            <span><strong>Reputação mínima:</strong> {demanda.reputacaoMinimaExigida.toFixed(1)} Nota</span>
            {demanda.prestadorEscolhido && (
              <span><strong>Prestador:</strong> {demanda.prestadorEscolhido.nome}</span>
            )}
          </div>

          {demanda.habilidadesExtras.length > 0 && (
            <div style={cd.tags}>
              {demanda.habilidadesExtras.map(h => <span key={h} style={cd.tag}>{h}</span>)}
            </div>
          )}

          {demanda.status !== 'CONCLUIDA' && demanda.status !== 'EXCLUIDA' && (
            <>
              <div style={cd.secaoTitulo}>
                Orçamentos recebidos
                {orcamentos.length > 0 && <span style={cd.count}>{orcamentos.length}</span>}
              </div>

              {carregandoOrcs ? (
                <p style={{ fontSize: '13px', color: 'var(--text)' }}>Carregando...</p>
              ) : orcamentos.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text)' }}>Nenhum orçamento recebido ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orcamentos.map(o => (
                    <CardOrcamento
                      key={o.id}
                      orc={o}
                      onAceitar={() => aceitarOrc(o.id)}
                      onRecusar={() => recusarOrc(o.id)}
                      onContrapropor={(v, m) => contrapropor(o.id, v, m)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <div style={cd.containerBotoesAcao}>
            {podeDesativar && (
              <button style={cd.btnCancelar} onClick={desativarDemanda}>
                Desativar demanda
              </button>
            )}

            {podeReativar && (
              <button style={cd.btnReativar} onClick={reativarDemanda}>
                Reativar demanda
              </button>
            )}

            {podeExcluir && (
              <button style={cd.btnExcluir} onClick={excluirDemandaDefinitivo}>
                Excluir demanda permanentemente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const cd: Record<string, React.CSSProperties> = {
  card: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' },
  cabecalho: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '16px' },
  esquerda: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  titulo: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  categoria: { fontSize: '12px', color: 'var(--text)' },
  meta: { fontSize: '11px', color: 'var(--text)', opacity: 0.7 },
  direita: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  statusBadge: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' },
  valor: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', minWidth: '80px', textAlign: 'right' },

  chevron: { fontSize: '10px', color: 'var(--text)', marginLeft: '6px', display: 'inline-block' },

  gavetaContainer: { 
    overflow: 'hidden', 
    transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
  },
  corpo: { padding: '0px 20px 20px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },

  descricao: { fontSize: '14px', color: 'var(--text)', lineHeight: '150%' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: 'var(--text)' },
  tags: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tag: { fontSize: '11px', backgroundColor: 'var(--code-bg)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text)' },
  secaoTitulo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  count: { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '2px 8px' },
  containerBotoesAcao: { display: 'flex', gap: '10px', marginTop: '4px' },
  btnCancelar: { alignSelf: 'flex-start', fontSize: '12px', fontWeight: 600, color: '#f59e0b', backgroundColor: '#f59e0b11', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' },
  btnReativar: { alignSelf: 'flex-start', fontSize: '12px', fontWeight: 600, color: '#22c55e', backgroundColor: '#22c55e11', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' },
  btnExcluir: { alignSelf: 'flex-start', fontSize: '12px', fontWeight: 600, color: '#dc2626', backgroundColor: '#ef444411', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' },
  avisoAvaliacao: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-h)', backgroundColor: '#22c55e11', padding: '10px 14px', borderRadius: '8px' },
  avisoAndamento: { fontSize: '12px', color: 'var(--text)', fontStyle: 'italic' },
};

// ─── Página principal ───────────────────────────────────────────────────────

interface SolicitacoesProps {
  usuarioId?: string;
}

/**
 * Página "Solicitações" do cliente. Lista as demandas do usuário organizadas
 * em abas ("Em Andamento" / "Histórico") e filtros (ativas, aprovadas,
 * desativadas), e permite criar novas demandas através do formulário.
 */
export default function Solicitacoes({ usuarioId }: SolicitacoesProps) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [modoAtivo, setModoAtivo] = useState<ModoAbaPainel>('andamento');
  const [abaFiltro, setAbaFiltro] = useState<'ativas' | 'aprovadas' | 'desativadas'>('ativas');

  /** Busca as demandas do cliente e a lista de categorias disponíveis. */
  const carregar = useCallback(async () => {
    if (!usuarioId) return;
    setCarregando(true);
    try {
      const [resDemandas, resCategorias] = await Promise.all([
        api.get(`/demandas/solicitacoes/${usuarioId}`),
        api.get('/categorias'),
      ]);
      setDemandas(resDemandas.data);
      setCategorias(resCategorias.data);
    } finally {
      setCarregando(false);
    }
  }, [usuarioId]);

  useEffect(() => { carregar(); }, [carregar]);

  const colecaoAndamento = useMemo(() => {
    return demandas.filter(d => ['ABERTA', 'NEGOCIACAO', 'APROVADA', 'DESABILITADA'].includes(d.status));
  }, [demandas]);

  const colecaoHistorico = useMemo(() => {
    return demandas.filter(d => ['CONCLUIDA', 'EXCLUIDA'].includes(d.status));
  }, [demandas]);

  const aprovadas = useMemo(() => colecaoAndamento.filter(d => d.status === 'APROVADA'), [colecaoAndamento]);
  const ativas = useMemo(() => colecaoAndamento.filter(d => ['ABERTA', 'NEGOCIACAO'].includes(d.status)), [colecaoAndamento]);
  const desativadas = useMemo(() => colecaoAndamento.filter(d => d.status === 'DESABILITADA'), [colecaoAndamento]);

  useSubpainelSidebar(
    <SubAbasPainel
      modoAtivo={modoAtivo}
      onMudarModo={setModoAtivo}
      totalAndamento={colecaoAndamento.length}
      totalHistorico={colecaoHistorico.length}
      labelAndamento="Em Andamento"
    />
  );

  if (carregando) return <p style={{ fontSize: '14px', color: 'var(--text)' }}>Carregando...</p>;

  return (
    <div>
      <div style={s.topo}>
        <h2 style={s.titulo}>
          {modoAtivo === 'andamento' ? 'Solicitações em Andamento' : 'Histórico de Solicitações'}
        </h2>
        <button style={s.btnNova} onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Fechar Formulário' : '+ Nova demanda'}
        </button>
      </div>

      {mostrarForm && (
        <div style={s.formContainer}>
          <FormNovaDemanda
            usuarioId={usuarioId!}
            categorias={categorias}
            onCriada={() => { setMostrarForm(false); carregar(); }}
          />
        </div>
      )}

      {modoAtivo === 'andamento' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Navegação por abas (estilo abas de navegador) */}
          <div style={s.containerAbasChrome}>
            <button 
              onClick={() => setAbaFiltro('ativas')}
              style={{ ...s.abaChrome, ...(abaFiltro === 'ativas' ? s.abaChromeAtiva : {}) }}
            >
              Ativas ({demandas.filter(d => ['ABERTA', 'NEGOCIACAO'].includes(d.status)).length})
            </button>
            <button 
              onClick={() => setAbaFiltro('aprovadas')}
              style={{ ...s.abaChrome, ...(abaFiltro === 'aprovadas' ? s.abaChromeAtiva : {}) }}
            >
              Aprovadas ({demandas.filter(d => d.status === 'APROVADA').length})
            </button>
            <button 
              onClick={() => setAbaFiltro('desativadas')}
              style={{ ...s.abaChrome, ...(abaFiltro === 'desativadas' ? s.abaChromeAtiva : {}) }}
            >
              Desativadas ({demandas.filter(d => d.status === 'DESABILITADA').length})
            </button>
          </div>

          {/* Lista filtrada de acordo com a aba selecionada */}
          <div>
            {abaFiltro === 'ativas' && (
              demandas.filter(d => ['ABERTA', 'NEGOCIACAO'].includes(d.status)).length === 0 ? (
                <p style={s.vazio}>Nenhuma solicitação ativa encontrada.</p>
              ) : (
                demandas.filter(d => ['ABERTA', 'NEGOCIACAO'].includes(d.status)).map(d => (
                  <CardDemanda key={d.id} demanda={d} onAtualizar={carregar} />
                ))
              )
            )}

            {abaFiltro === 'aprovadas' && (
              demandas.filter(d => d.status === 'APROVADA').length === 0 ? (
                <p style={s.vazio}>Nenhuma solicitação aprovada encontrada.</p>
              ) : (
                demandas.filter(d => d.status === 'APROVADA').map(d => (
                  <CardDemanda key={d.id} demanda={d} onAtualizar={carregar} />
                ))
              )
            )}

            {abaFiltro === 'desativadas' && (
              demandas.filter(d => d.status === 'DESABILITADA').length === 0 ? (
                <p style={s.vazio}>Nenhuma solicitação desativada encontrada.</p>
              ) : (
                demandas.filter(d => d.status === 'DESABILITADA').map(d => (
                  <CardDemanda key={d.id} demanda={d} onAtualizar={carregar} />
                ))
              )
            )}
          </div>

        </div>
      )}

      {modoAtivo === 'historico' && (
        <div style={s.stackVertical}>
          {colecaoHistorico.length === 0 ? (
            <p style={s.vazio}>Nenhum registro encontrado no histórico.</p>
          ) : (
            colecaoHistorico.map(d => <CardDemanda key={d.id} demanda={d} onAtualizar={carregar} />)
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  topo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  titulo: { fontSize: '18px', fontWeight: 700, color: 'var(--text-h)', margin: 0 },
  btnNova: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' },
  formContainer: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '24px' },
  stackVertical: { display: 'flex', flexDirection: 'column', gap: '24px' },
  blocoRaia: { display: 'flex', flexDirection: 'column' },
  tituloRaia: { fontSize: '13px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', opacity: 0.8 },
  vazio: { fontSize: '13px', color: 'var(--text)', fontStyle: 'italic', padding: '16px 0' },
  containerAbasChrome: { display: 'flex', borderBottom: '1px solid var(--border)', gap: '4px', marginBottom: '8px' },
  abaChrome: { padding: '10px 20px', background: 'none', border: 'none', borderBottom: '3px solid transparent', color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' },
  abaChromeAtiva: { borderBottomColor: 'var(--accent)', color: 'var(--text-h)' },
};
