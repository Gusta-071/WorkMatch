/**
 * Aba "Explorar".
 * Lista as demandas abertas no mercado para o prestador, calculando um
 * score de compatibilidade (match) com base nas competências do usuário
 * e permitindo o envio de orçamentos diretamente pelos cards.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../api';
import { useSubpainelSidebar } from '../layouts/SubpainelContext';
import FiltrosExplorar, { FILTROS_INICIAIS, type FiltrosState } from '../components/FiltrosExplorar';
import type { Demanda, Categoria, Usuario } from '../types';

interface ExplorarProps {
  usuarioId?: string;
}

// Calcula o percentual de compatibilidade entre as competências do usuário
// e as habilidades exigidas pela demanda (da categoria + habilidades extras).
function calcularMatchScore(demanda: Demanda, competenciasUsuario: string[], habilidadesPorCategoria: Map<number, string[]>): number {
  const habilidadesCategoria = habilidadesPorCategoria.get(demanda.categoria.id) ?? [];
  const conjuntoRelevante = new Set([
    ...habilidadesCategoria.map(h => h.toLowerCase()),
    ...demanda.habilidadesExtras.map(h => h.toLowerCase()),
  ]);
  if (conjuntoRelevante.size === 0) return 100;

  const competenciasSet = new Set(competenciasUsuario.map(c => c.toLowerCase()));
  let acertos = 0;
  conjuntoRelevante.forEach(h => {
    if (competenciasSet.has(h)) acertos++;
  });
  return Math.min((acertos / conjuntoRelevante.size) * 100, 100);
}

// Formata um valor numérico como moeda brasileira.
function brl(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata data + hora no padrão pt-BR (ex: 05/07/2026 às 14:32).
function formatarDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const data = new Date(valor);
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataFormatada} às ${horaFormatada}`;
}

// ─── CARD DE DEMANDA (EXPLORAR) ────────────────────────────────────────────

// Observação: como as demandas com proposta enviada já são filtradas antes
// de chegar aqui (ver `demandasFiltradas`), a prop `propostaEnviada` na
// prática nunca deve vir `true`. Mantida por segurança/compatibilidade.
interface CardExplorarProps {
  demanda: Demanda;
  destaque?: boolean;
  valor: string;
  mensagem: string;
  enviando: boolean;
  propostaEnviada: boolean;
  onValorChange: (val: string) => void;
  onMensagemChange: (val: string) => void;
  onEnviar: () => Promise<boolean> | boolean | void;
}

// Card expansível de uma demanda, com formulário de envio de orçamento embutido.
function CardExplorar({
  demanda,
  destaque = false,
  valor,
  mensagem,
  enviando,
  propostaEnviada,
  onValorChange,
  onMensagemChange,
  onEnviar
}: CardExplorarProps) {
  const [aberto, setAberto] = useState(false);
  const [enviadoLocal, setEnviadoLocal] = useState(false); // feedback imediato, independente do estado do pai
  const conteudoRef = useRef<HTMLDivElement>(null);

  // Respeita também um eventual sinal vindo do componente pai (ex: se o ID
  // já chegar marcado como enviado ao carregar a página).
  const jaEnviada = propostaEnviada || enviadoLocal;

  // Envia o orçamento e marca o card como enviado, a menos que o envio falhe explicitamente.
  const handleEnviar = async () => {
    const resultado = await onEnviar();
    if (resultado !== false) {
      setEnviadoLocal(true);
    }
  };

  const matchColor = useMemo(() => {
    const score = demanda.matchScore ?? 0;
    if (score >= 75) return '#22c55e';
    if (score >= 40) return '#f59e0b';
    return '#6b7280';
  }, [demanda.matchScore]);

  return (
    <div style={{
      ...cd.card,
      borderColor: jaEnviada ? 'var(--border)' : (destaque ? 'var(--accent)' : 'var(--border)'),
      boxShadow: !jaEnviada && destaque ? '0 0 12px var(--accent-border)' : 'none',
      opacity: jaEnviada ? 0.65 : 1
    }}>
      <button style={cd.cabecalho} onClick={() => setAberto(!aberto)}>
        <div style={cd.esquerda}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              ...cd.titulo,
              textDecoration: jaEnviada ? 'line-through' : 'none'
            }}>{demanda.titulo}</span>
            {demanda.matchScore !== undefined && !jaEnviada && (
              <span style={{
                ...cd.matchBadge,
                backgroundColor: matchColor + '15',
                color: matchColor,
                border: `1px solid ${matchColor}33`
              }}>
                {demanda.matchScore.toFixed(0)}% Match
              </span>
            )}
            {jaEnviada && (
              <span style={cd.badgeEnviado}>✓ Proposta enviada</span>
            )}
          </div>
          <span style={cd.categoria}>
            {demanda.categoria.nome} • Nível Exigido: {demanda.nivelMinimoExigido}
          </span>
        </div>
        <div style={cd.direita}>
          <span style={cd.valor}>
            {demanda.valorComTaxa !== null
              ? brl(demanda.valorComTaxa)
              : demanda.valorEstimado !== null
                ? brl(demanda.valorEstimado)
                : 'A combinar'}
          </span>
          <span style={{ 
            ...cd.chevron, 
            transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>▼</span>
        </div>
      </button>

      <div style={{
        ...cd.gavetaContainer,
        maxHeight: aberto ? `${conteudoRef.current?.scrollHeight}px` : '0px',
        opacity: aberto ? 1 : 0,
      }}>
        <div ref={conteudoRef} style={cd.corpo}>
          <p style={cd.descricao}>{demanda.descricao}</p>
          
          <div style={cd.grid}>
            <span><strong>Contratante:</strong> {demanda.contratante?.nome || 'Não informado'}</span>
            <span><strong>Reputação do Cliente:</strong> ★ {demanda.contratante?.reputacaoCliente?.toFixed(1) || '0.0'}</span>
            <span><strong>Prazo de Finalização:</strong> {new Date(demanda.prazoFinalizacao).toLocaleDateString('pt-BR')}</span>
            <span><strong>Publicada em:</strong> {formatarDataHora(demanda.dataCriacao)}</span>
          </div>

          {jaEnviada && (
            <div style={cd.containerBloqueado}>
              <span style={cd.iconeTrava}>🔒</span>
              <span>Você já enviou uma proposta para este serviço. Aguarde o retorno do cliente.</span>
            </div>
          )}

          <div style={cd.formOrcamento}>
            <input
              type="number"
              placeholder="Seu valor (R$)"
              value={valor}
              onChange={e => onValorChange(e.target.value)}
              style={cd.input}
              disabled={jaEnviada}
            />
            <input
              placeholder="Mensagem (opcional)"
              value={mensagem}
              onChange={e => onMensagemChange(e.target.value)}
              style={cd.input}
              disabled={jaEnviada}
            />
            <button
              style={{
                ...cd.botaoEnviar,
                ...(jaEnviada ? cd.botaoEnviarDesabilitado : {})
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleEnviar();
              }}
              disabled={enviando || jaEnviada}
            >
              {jaEnviada ? 'Proposta enviada' : (enviando ? 'Enviando...' : 'Confirmar Envio')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Estilos do CardExplorar.
const cd: Record<string, React.CSSProperties> = {
  card: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', transition: 'all 0.2s ease' },
  cabecalho: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '16px' },
  esquerda: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  titulo: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  matchBadge: { fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' },
  badgeEnviado: { fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', border: '1px solid rgba(107, 114, 128, 0.2)' },
  categoria: { fontSize: '12px', color: 'var(--text)' },
  direita: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  valor: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', minWidth: '80px', textAlign: 'right' },
  chevron: { fontSize: '10px', color: 'var(--text)', marginLeft: '6px', display: 'inline-block' },
  gavetaContainer: { overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease' },
  corpo: { padding: '0px 20px 20px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  descricao: { fontSize: '14px', color: 'var(--text)', lineHeight: '150%' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: 'var(--text)', backgroundColor: 'var(--code-bg)', padding: '10px 14px', borderRadius: '8px' },
  formOrcamento: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', paddingTop: '12px', borderTop: '1px dashed var(--border)' },
  input: { flex: 1, minWidth: '140px', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text-h)' },
  botaoEnviar: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  botaoEnviarDesabilitado: { backgroundColor: '#9ca3af', color: '#f3f4f6', cursor: 'not-allowed' },
  containerBloqueado: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: 'var(--code-bg)', color: '#6b7280', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', fontSize: '13px', fontWeight: 500, textAlign: 'center' },
  iconeTrava: { fontSize: '14px' }
};

// ─── PAINEL PRINCIPAL ───────────────────────────────────────────────────────

export default function Explorar({ usuarioId }: ExplorarProps) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_INICIAIS);
  const [carregando, setCarregando] = useState(true);
  const [valorOrcamento, setValorOrcamento] = useState<Record<string, string>>({});
  const [mensagemOrcamento, setMensagemOrcamento] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [idsComProposta, setIdsComProposta] = useState<string[]>([]);

  // Ao trocar de usuário, recupera do localStorage as propostas já enviadas
  // e carrega os dados da tela.
  useEffect(() => {
    if (!usuarioId) return;
    
    try {
      const local = localStorage.getItem(`propostas_enviadas_${usuarioId}`);
      if (local) {
        setIdsComProposta(JSON.parse(local));
      } else {
        setIdsComProposta([]);
      }
    } catch (e) {
      console.error(e);
      setIdsComProposta([]);
    }

    carregarDados();
  }, [usuarioId]);

  // Busca demandas disponíveis, categorias e dados do usuário em paralelo.
  const carregarDados = async () => {
    if (!usuarioId) return;
    setCarregando(true);
    try {
      const [resDemandas, resCategorias, resUsuario] = await Promise.all([
        api.get(`/demandas/explorar/${usuarioId}`),
        api.get('/categorias'),
        api.get(`/usuarios/${usuarioId}`),
      ]);
      setDemandas(resDemandas.data);
      setCategorias(resCategorias.data);
      setUsuario(resUsuario.data);
    } catch (err) {
      console.error('Erro ao carregar Explorar', err);
    } finally {
      setCarregando(false);
    }
  };

  // Mapa de categoriaId -> nomes de habilidades, para cálculo de match e filtros.
  const habilidadesPorCategoria = useMemo(() => {
    const mapa = new Map<number, string[]>();
    categorias.forEach(c => mapa.set(c.id, c.habilidades.map(h => h.nome)));
    return mapa;
  }, [categorias]);

  // Enriquece cada demanda com o score de compatibilidade do usuário atual.
  const demandasComMatch: Demanda[] = useMemo(() => {
    if (!usuario) return demandas;
    return demandas.map(d => ({
      ...d,
      matchScore: calcularMatchScore(d, usuario.competencias, habilidadesPorCategoria),
    }));
  }, [demandas, usuario, habilidadesPorCategoria]);

  // Aplica os filtros da barra lateral (categoria, habilidades, match mínimo,
  // faixa de valor, reputação e nível exigido) sobre a lista de demandas.
  const demandasFiltradas = useMemo(() => {
    return demandasComMatch.filter(d => {
      // Demandas que já receberam proposta deste prestador somem da listagem.
      if (idsComProposta.some(id => String(id) === String(d.id))) return false;
      if (filtros.categoriasSelecionadas.length > 0 && !filtros.categoriasSelecionadas.includes(d.categoria.id)) return false;
      if (filtros.habilidadesSelecionadas.length > 0) {
        const habilidadesDemanda = new Set([
          ...(habilidadesPorCategoria.get(d.categoria.id) ?? []),
          ...d.habilidadesExtras,
        ].map(h => h.toLowerCase()));
        const temAlguma = filtros.habilidadesSelecionadas.some(h => habilidadesDemanda.has(h.toLowerCase()));
        if (!temAlguma) return false;
      }
      if ((d.matchScore ?? 0) < filtros.matchMinimo) return false;
      // Demandas sem valor definido ("a combinar") são excluídas quando o
      // filtro de preço está ativo, já que não há como compará-las a uma faixa.
      if (filtros.valorMin !== null && (d.valorComTaxa === null || d.valorComTaxa < filtros.valorMin)) return false;
      if (filtros.valorMax !== null && (d.valorComTaxa === null || d.valorComTaxa > filtros.valorMax)) return false;
      if (d.reputacaoMinimaExigida < filtros.reputacaoMinimaPrestador) return false;
      if (filtros.niveisSelecionados.length > 0 && !filtros.niveisSelecionados.includes(d.nivelMinimoExigido)) return false;
      return true;
    });
  }, [demandasComMatch, filtros, habilidadesPorCategoria, idsComProposta]);

  // Seleciona as 5 demandas com melhor match (acima de 40%) para a seção "Indicados".
  const indicados = useMemo(() => {
    return [...demandasFiltradas]
      .filter(d => (d.matchScore ?? 0) > 40)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      .slice(0, 5);
  }, [demandasFiltradas]);

  const idsIndicados = new Set(indicados.map(d => d.id));
  const restoDaLista = demandasFiltradas.filter(d => !idsIndicados.has(d.id));

  // Registra o painel de filtros na barra lateral do subpainel.
  useSubpainelSidebar(
    <FiltrosExplorar categorias={categorias} filtros={filtros} onMudar={setFiltros} />
  );

  // Envia um orçamento para a demanda informada e atualiza o estado local
  // de propostas enviadas (persistido no localStorage).
  const enviarOrcamento = async (demandaId: string): Promise<boolean> => {
    const valorBruto = valorOrcamento[demandaId];
    const valor = valorBruto ? Number(valorBruto) : 0;

    if (!valor || valor <= 0) {
      alert('Informe um valor válido para o orçamento.');
      return false;
    }

    setEnviando(demandaId);
    try {
      await api.post(`/demandas/${demandaId}/orcamentos`, {
        prestadorId: usuarioId,
        valorProposto: valor,
        mensagem: mensagemOrcamento[demandaId] || null,
      });

      setIdsComProposta(prev => {
        const novaLista = [...prev, demandaId];
        localStorage.setItem(`propostas_enviadas_${usuarioId}`, JSON.stringify(novaLista));
        return novaLista;
      });

      setValorOrcamento(prev => ({ ...prev, [demandaId]: '' }));
      setMensagemOrcamento(prev => ({ ...prev, [demandaId]: '' }));

      alert('Orçamento enviado com sucesso!');
      carregarDados();
      return true;
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Não foi possível enviar o orçamento.');
      return false;
    } finally {
      setEnviando(null);
    }
  };

  if (carregando) return <p style={{ fontSize: '14px', color: 'var(--text)' }}>Carregando demandas...</p>;

  return (
    <div>
      <h2 style={styles.tituloSecao}>Indicados para você</h2>
      {indicados.length === 0 ? (
        <p style={styles.vazio}>Cadastre habilidades no seu Perfil para receber indicações personalizadas.</p>
      ) : (
        indicados.map(d => (
          <CardExplorar 
            key={d.id} 
            demanda={d} 
            destaque
            valor={valorOrcamento[d.id] ?? ''}
            mensagem={mensagemOrcamento[d.id] ?? ''}
            enviando={enviando === d.id}
            propostaEnviada={idsComProposta.some(id => String(id) === String(d.id))}
            onValorChange={(val) => setValorOrcamento(prev => ({ ...prev, [d.id]: val }))}
            onMensagemChange={(val) => setMensagemOrcamento(prev => ({ ...prev, [d.id]: val }))}
            onEnviar={() => enviarOrcamento(d.id)}
          />
        ))
      )}

      <h2 style={{ ...styles.tituloSecao, marginTop: '32px' }}>Explorar</h2>
      {restoDaLista.length === 0 ? (
        <p style={styles.vazio}>Nenhuma demanda encontrada com esses filtros.</p>
      ) : (
        restoDaLista.map(d => (
          <CardExplorar 
            key={d.id} 
            demanda={d} 
            valor={valorOrcamento[d.id] ?? ''}
            mensagem={mensagemOrcamento[d.id] ?? ''}
            enviando={enviando === d.id}
            propostaEnviada={idsComProposta.some(id => String(id) === String(d.id))}
            onValorChange={(val) => setValorOrcamento(prev => ({ ...prev, [d.id]: val }))}
            onMensagemChange={(val) => setMensagemOrcamento(prev => ({ ...prev, [d.id]: val }))}
            onEnviar={() => enviarOrcamento(d.id)}
          />
        ))
      )}
    </div>
  );
}

// Estilos do painel principal.
const styles: Record<string, React.CSSProperties> = {
  tituloSecao: { fontSize: '18px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '16px' },
  vazio: { fontSize: '13px', color: 'var(--text)', fontStyle: 'italic', paddingBottom: '8px' }
};
