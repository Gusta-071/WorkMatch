/**
 * Aba "Servicos"
 * Painel do prestador para gerenciar propostas (orçamentos) e serviços
 * aprovados/concluídos: abas "Em Andamento" (ativos, aprovados, recusados)
 * e "Histórico" (arquivados, concluídos), com ações de negociação, conclusão
 * e avaliação.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useSubpainelSidebar } from '../layouts/SubpainelContext';
import SubAbasPainel, { type ModoAbaPainel } from '../components/SubAbasPainel';
import ModalAvaliacao from '../components/ModalAvaliacao';
import type { Orcamento, DemandaServico, StatusOrcamento } from '../types';
import { LABEL_NIVEL } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Formata um número como moeda brasileira (R$). */
function brl(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata uma data ISO como "dd/mm/aaaa às hh:mm", ou "—" se nula. */
function formatarData(iso: string | null) {
  if (!iso) return '—';
  const data = new Date(iso);
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataFormatada} às ${horaFormatada}`;
}

/** Cor associada a cada status de orçamento, usada nos badges. */
const COR_STATUS_ORCAMENTO: Record<StatusOrcamento, string> = {
  PENDENTE: '#f59e0b',
  ACEITO: '#22c55e',
  RECUSADO: '#ef4444',
  EXCLUIDO: '#9ca3af',
};

// ─── Card de proposta enviada (negociação) ─────────────────────────────────

interface CardPropostaProps {
  orc: Orcamento;
  usuarioId: string;
  onAtualizar: () => void;
}

/**
 * Card de uma proposta (orçamento) enviada pelo prestador a um cliente.
 * Exibe o status atual e permite aceitar, recusar, contrapropor, reenviar
 * ou arquivar a proposta, conforme o estado da negociação.
 */
function CardProposta({ orc, usuarioId, onAtualizar }: CardPropostaProps) {
  const [modo, setModo] = useState<'nada' | 'contra' | 'reenviar'>('nada');
  const [valorForm, setValorForm] = useState('');
  const [mensagemForm, setMensagemForm] = useState('');
  const [enviando, setEnviando] = useState(false);

  const suaVez = orc.status === 'PENDENTE' && orc.ultimaPropostaPor === 'CLIENTE';
  const demandaId = orc.demanda?.id;

  // A demanda associada pode ter saído de jogo (desativada pelo cliente ou
  // aprovada com outro prestador) enquanto este orçamento segue "PENDENTE".
  const statusDemanda = orc.demanda?.status;
  const foraDeJogo = orc.status === 'PENDENTE' && (statusDemanda === 'DESABILITADA' || statusDemanda === 'EXCLUIDA' || statusDemanda === 'APROVADA');
  const canceladaPeloCliente = orc.status === 'PENDENTE' && (statusDemanda === 'DESABILITADA' || statusDemanda === 'EXCLUIDA');
  const perdeuParaOutroPrestador = orc.status === 'PENDENTE' && statusDemanda === 'APROVADA';

  /** Aceita o valor proposto pelo cliente, encerrando a negociação. */
  const aceitar = async () => {
    if (!confirm('Aceitar o valor proposto pelo cliente?')) return;
    setEnviando(true);
    try {
      await api.post(`/orcamentos/${orc.id}/aceitar`);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao aceitar.');
    } finally {
      setEnviando(false);
    }
  };

  /** Recusa (ou retira) a proposta atual. */
  const recusar = async () => {
    if (!confirm('Recusar/retirar esta proposta?')) return;
    setEnviando(true);
    try {
      await api.post(`/orcamentos/${orc.id}/recusar`, { mensagem: null });
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao recusar.');
    } finally {
      setEnviando(false);
    }
  };

  /** Envia uma contraproposta com novo valor e mensagem opcional. */
  const contrapropor = async () => {
    const valor = Number(valorForm);
    if (!valor || valor <= 0) return alert('Informe um valor válido.');
    setEnviando(true);
    try {
      await api.patch(`/orcamentos/${orc.id}/contrapropor`, {
        autor: 'PRESTADOR',
        novoValor: valor,
        mensagem: mensagemForm || null,
      });
      setModo('nada');
      setValorForm('');
      setMensagemForm('');
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao contrapropor.');
    } finally {
      setEnviando(false);
    }
  };

  /** Envia uma nova proposta para a mesma demanda após uma recusa anterior. */
  const reenviar = async () => {
    const valor = Number(valorForm);
    if (!valor || valor <= 0) return alert('Informe um valor válido.');
    if (!demandaId) return;
    setEnviando(true);
    try {
      await api.post(`/demandas/${demandaId}/orcamentos`, {
        prestadorId: usuarioId,
        valorProposto: valor,
        mensagem: mensagemForm || null,
      });
      setModo('nada');
      setValorForm('');
      setMensagemForm('');
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao reenviar proposta.');
    } finally {
      setEnviando(false);
    }
  };

  /** Arquiva a proposta recusada, movendo-a para o histórico. */
  const excluir = async () => {
    if (!confirm('Excluir esta proposta? Ela será movida para o histórico.')) return;
    setEnviando(true);
    try {
      await api.delete(`/orcamentos/${orc.id}`);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao excluir.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={cp.card}>
      <div style={cp.linha}>
        <div style={cp.esquerda}>
          <span style={cp.titulo}>{orc.demanda?.titulo}</span>
          <span style={cp.categoria}>{orc.demanda?.categoria}</span>
        </div>
        <div style={cp.direita}>
          <span style={{
            ...cp.badge,
            backgroundColor: (foraDeJogo ? '#9ca3af' : COR_STATUS_ORCAMENTO[orc.status]) + '22',
            color: foraDeJogo ? '#6b7280' : COR_STATUS_ORCAMENTO[orc.status],
          }}>
            {perdeuParaOutroPrestador ? 'NÃO SELECIONADO' : canceladaPeloCliente ? 'CANCELADA' : orc.status}
          </span>
          <span style={cp.valor}>{brl(orc.valorProposto)}</span>
        </div>
      </div>

      {orc.mensagem && <p style={cp.mensagem}>"{orc.mensagem}"</p>}

      {canceladaPeloCliente && (
        <p style={cp.avisoCancelada}>❌ O cliente desativou esta solicitação. Não é mais possível negociar.</p>
      )}

      {perdeuParaOutroPrestador && (
        <p style={cp.avisoCancelada}>O cliente fechou esta demanda com outro prestador.</p>
      )}

      {!foraDeJogo && orc.status === 'PENDENTE' && (
        <p style={cp.aviso}>
          {suaVez ? 'O cliente respondeu — é a sua vez de agir.' : 'Aguardando resposta do cliente.'}
        </p>
      )}

      {!foraDeJogo && orc.status === 'PENDENTE' && modo === 'nada' && (
        <div style={cp.acoes}>
          {suaVez && <button style={cp.btnAceitar} disabled={enviando} onClick={aceitar}>Aceitar valor</button>}
          {suaVez && <button style={cp.btnContra} disabled={enviando} onClick={() => setModo('contra')}>Contrapropor</button>}
          <button style={cp.btnRecusar} disabled={enviando} onClick={recusar}>
            {suaVez ? 'Recusar' : 'Retirar proposta'}
          </button>
        </div>
      )}

      {foraDeJogo && (
        <div style={cp.acoes}>
          <button style={cp.btnRecusar} disabled={enviando} onClick={excluir}>Arquivar (mover p/ histórico)</button>
        </div>
      )}

      {modo === 'contra' && (
        <div style={cp.formInline}>
          <input type="number" placeholder="Novo valor (R$)" value={valorForm} onChange={e => setValorForm(e.target.value)} style={cp.input} />
          <input placeholder="Mensagem (opcional)" value={mensagemForm} onChange={e => setMensagemForm(e.target.value)} style={cp.input} />
          <div style={cp.acoes}>
            <button style={cp.btnSecundario} onClick={() => setModo('nada')}>Cancelar</button>
            <button style={cp.btnAceitar} disabled={enviando} onClick={contrapropor}>Enviar contraproposta</button>
          </div>
        </div>
      )}

      {orc.status === 'RECUSADO' && modo === 'nada' && (
        <div style={cp.acoes}>
          <button style={cp.btnContra} onClick={() => setModo('reenviar')}>Enviar nova proposta</button>
          <button style={cp.btnRecusar} disabled={enviando} onClick={excluir}>Excluir (mover p/ histórico)</button>
        </div>
      )}

      {modo === 'reenviar' && (
        <div style={cp.formInline}>
          <input type="number" placeholder="Valor (R$)" value={valorForm} onChange={e => setValorForm(e.target.value)} style={cp.input} />
          <input placeholder="Mensagem (opcional)" value={mensagemForm} onChange={e => setMensagemForm(e.target.value)} style={cp.input} />
          <div style={cp.acoes}>
            <button style={cp.btnSecundario} onClick={() => setModo('nada')}>Cancelar</button>
            <button style={cp.btnAceitar} disabled={enviando} onClick={reenviar}>Enviar</button>
          </div>
        </div>
      )}

      {orc.status === 'EXCLUIDO' && (
        <p style={cp.aviso}>Proposta recusada e arquivada em {formatarData(orc.dataAtualizacao ?? null)}.</p>
      )}
    </div>
  );
}

const cp: Record<string, React.CSSProperties> = {
  card: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  linha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' },
  esquerda: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  titulo: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  categoria: { fontSize: '12px', color: 'var(--text)' },
  direita: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  badge: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' },
  valor: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  mensagem: { fontSize: '13px', color: 'var(--text)', fontStyle: 'italic', margin: 0 },
  aviso: { fontSize: '12px', color: 'var(--accent)', margin: 0, fontWeight: 600 },
  avisoCancelada: { fontSize: '12px', color: '#dc2626', margin: 0, fontWeight: 600 },
  acoes: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  formInline: { display: 'flex', flexDirection: 'column', gap: '8px' },
  input: { padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: 'var(--bg)', color: 'var(--text-h)' },
  btnAceitar: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: '#22c55e22', color: '#16a34a' },
  btnContra: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: '#f59e0b22', color: '#b45309', alignSelf: 'flex-start' },
  btnRecusar: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: '#ef444422', color: '#dc2626' },
  btnSecundario: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', backgroundColor: 'var(--border)', color: 'var(--text-h)' },
};

// ─── Card de serviço (aprovado / concluído) ────────────────────────────────

interface CardServicoProps {
  demanda: DemandaServico;
  usuarioId: string;
  onAtualizar: () => void;
}

/**
 * Card de um serviço já aprovado. Cobre o fluxo pós-aprovação: marcar a
 * entrega como concluída, avaliar a outra parte e exibir o resultado final
 * quando o serviço já estiver concluído.
 */
function CardServico({ demanda, usuarioId, onAtualizar }: CardServicoProps) {
  const [enviando, setEnviando] = useState(false);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);

  const contraparte = demanda.contratante;
  const minhaNota = demanda.notaPrestadorParaCliente;
  const notaDoOutro = demanda.notaClienteParaPrestador;

  /**
   * Marca o serviço como concluído pelo prestador. A avaliação do cliente
   * não é solicitada neste momento — o modal de avaliação abre em seguida.
   */
  const concluir = async () => {
    setEnviando(true);
    try {
      await api.post(`/demandas/${demanda.id}/concluir`, { prestadorId: usuarioId });
      onAtualizar();
      setMostrarAvaliacao(true);
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao concluir.');
    } finally {
      setEnviando(false);
    }
  };

  /** Envia a nota de avaliação do prestador para o cliente. */
  const avaliarCliente = async (nota: number) => {
    setEnviando(true);
    try {
      await api.post(`/demandas/${demanda.id}/avaliar-cliente`, { prestadorId: usuarioId, nota });
      setMostrarAvaliacao(false);
      onAtualizar();
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Erro ao avaliar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={cs.card}>
      <div style={cs.linha}>
        <div style={cs.esquerda}>
          <span style={cs.titulo}>{demanda.titulo}</span>
          <span style={cs.categoria}>{demanda.categoria.nome} · Cliente: {contraparte?.nome ?? '—'}</span>
        </div>
        <span style={cs.valor}>{brl(demanda.valorFinalAcordado)}</span>
      </div>

      <div style={cs.grid}>
        <span><strong>Nível:</strong> {LABEL_NIVEL[demanda.nivelMinimoExigido]}</span>
        <span><strong>Criada em:</strong> {formatarData(demanda.dataCriacao)}</span>
        <span><strong>Aprovado em:</strong> {formatarData(demanda.dataAprovacao)}</span>
      </div>

      {demanda.status === 'APROVADA' && (
        <>
          {/* Estágio 1: prestador ainda não marcou a entrega */}
          {!demanda.dataEntregaPrestador && (
            <button style={cs.btnPrimario} disabled={enviando} onClick={concluir}>
              {enviando ? 'Enviando...' : 'Marcar serviço como concluído'}
            </button>
          )}

          {/* Estágio 2: entregue — falta o prestador avaliar o cliente */}
          {demanda.dataEntregaPrestador && (
            <>
              <p style={cs.avisoOk}>Serviço entregue em {formatarData(demanda.dataEntregaPrestador)}.</p>

              {minhaNota === null && (
                <button style={cs.btnContra} onClick={() => setMostrarAvaliacao(true)}>Avaliar cliente</button>
              )}

              {minhaNota !== null && notaDoOutro === null && (
                <p style={cs.aviso}>Você já avaliou. Aguardando avaliação do cliente para concluir.</p>
              )}
            </>
          )}
        </>
      )}

      {demanda.status === 'CONCLUIDA' && (
        <div style={cs.grid}>
          <span><strong>Nota do prestador ao cliente:</strong> {demanda.notaPrestadorParaCliente ?? '—'} ⭐</span>
          <span><strong>Nota do cliente ao prestador:</strong> {demanda.notaClienteParaPrestador ?? '—'} ⭐</span>
        </div>
      )}

      {mostrarAvaliacao && (
        <ModalAvaliacao
          titulo="Avaliar o cliente"
          descricao={`Como foi sua experiência com ${contraparte?.nome ?? 'a outra parte'} neste serviço?`}
          enviando={enviando}
          aoFechar={() => setMostrarAvaliacao(false)}
          aoConfirmar={avaliarCliente}
        />
      )}
    </div>
  );
}

const cs: Record<string, React.CSSProperties> = {
  card: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  linha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' },
  esquerda: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  titulo: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  categoria: { fontSize: '12px', color: 'var(--text)' },
  valor: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: 'var(--text)' },
  aviso: { fontSize: '13px', color: 'var(--text)', margin: 0 },
  avisoOk: { fontSize: '13px', color: '#16a34a', margin: 0, fontWeight: 600 },
  btnPrimario: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', alignSelf: 'flex-start' },
  btnContra: { fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', backgroundColor: '#f59e0b22', color: '#b45309', alignSelf: 'flex-start' },
};

// ─── Página principal ───────────────────────────────────────────────────────

interface ServicosProps {
  usuarioId?: string;
}

/**
 * Página "Serviços" do prestador. Carrega propostas enviadas e serviços
 * aprovados, organiza-os em abas ("Em Andamento" / "Histórico") e filtros
 * (ativos, aprovados, recusados), e recarrega os dados após cada ação.
 */
export default function Servicos({ usuarioId }: ServicosProps) {
  const [propostas, setPropostas] = useState<Orcamento[]>([]);
  const [servicos, setServicos] = useState<DemandaServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modoAtivo, setModoAtivo] = useState<ModoAbaPainel>('andamento');
  const [filtro, setFiltro] = useState<'ativos' | 'aprovados' | 'recusados'>('ativos');

  /** Busca propostas e serviços do prestador atual. */
  const carregar = useCallback(async () => {
    if (!usuarioId) return;
    setCarregando(true);
    try {
      const [resPropostas, resServicos] = await Promise.all([
        api.get(`/orcamentos/prestador/${usuarioId}`),
        api.get(`/demandas/servicos/${usuarioId}`),
      ]);
      setPropostas(resPropostas.data);
      setServicos(resServicos.data);
    } finally {
      setCarregando(false);
    }
  }, [usuarioId]);

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * Indica se uma proposta PENDENTE perdeu validade porque a demanda
   * associada saiu de jogo (desativada/excluída pelo cliente, ou aprovada
   * com outro prestador), mesmo sem resposta explícita do cliente.
   */
  const foiEncerradaSemResposta = (o: Orcamento) => {
    if (o.status !== 'PENDENTE') return false;
    const st = o.demanda?.status;
    return st === 'DESABILITADA' || st === 'EXCLUIDA' || st === 'APROVADA';
  };

  const ativos = useMemo(() => propostas.filter(o => o.status === 'PENDENTE' && !foiEncerradaSemResposta(o)), [propostas]);
  const aprovados = useMemo(() => servicos.filter(d => d.status === 'APROVADA'), [servicos]);
  const recusados = useMemo(() => propostas.filter(o => o.status === 'RECUSADO' || foiEncerradaSemResposta(o)), [propostas]);
  const propostasExcluidas = useMemo(() => propostas.filter(o => o.status === 'EXCLUIDO'), [propostas]);
  const concluidos = useMemo(() => servicos.filter(d => d.status === 'CONCLUIDA'), [servicos]);

  const totalAndamento = ativos.length + aprovados.length + recusados.length;
  const totalHistorico = propostasExcluidas.length + concluidos.length;

  useSubpainelSidebar(
    <SubAbasPainel
      modoAtivo={modoAtivo}
      onMudarModo={setModoAtivo}
      totalAndamento={totalAndamento}
      totalHistorico={totalHistorico}
    />
  );

  if (carregando) return <p style={{ fontSize: '14px', color: 'var(--text)' }}>Carregando...</p>;

  return (
    <div>
      <h2 style={s.titulo}>
        {modoAtivo === 'andamento' ? 'Orçamentos em Andamento' : 'Histórico de Orçamentos'}
      </h2>

      {modoAtivo === 'andamento' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={s.containerAbasChrome}>
            <button onClick={() => setFiltro('ativos')} style={{ ...s.abaChrome, ...(filtro === 'ativos' ? s.abaChromeAtiva : {}) }}>
              Ativos ({ativos.length})
            </button>
            <button onClick={() => setFiltro('aprovados')} style={{ ...s.abaChrome, ...(filtro === 'aprovados' ? s.abaChromeAtiva : {}) }}>
              Aprovados ({aprovados.length})
            </button>
            <button onClick={() => setFiltro('recusados')} style={{ ...s.abaChrome, ...(filtro === 'recusados' ? s.abaChromeAtiva : {}) }}>
              Recusados ({recusados.length})
            </button>
          </div>

          <div>
            {filtro === 'ativos' && (
              ativos.length === 0
                ? <p style={s.vazio}>Nenhuma proposta ativa no momento. Veja demandas em "Explorar".</p>
                : ativos.map(o => <CardProposta key={o.id} orc={o} usuarioId={usuarioId!} onAtualizar={carregar} />)
            )}
            {filtro === 'aprovados' && (
              aprovados.length === 0
                ? <p style={s.vazio}>Nenhum serviço aprovado no momento.</p>
                : aprovados.map(d => <CardServico key={d.id} demanda={d} usuarioId={usuarioId!} onAtualizar={carregar} />)
            )}
            {filtro === 'recusados' && (
              recusados.length === 0
                ? <p style={s.vazio}>Nenhuma proposta recusada aguardando arquivamento.</p>
                : recusados.map(o => <CardProposta key={o.id} orc={o} usuarioId={usuarioId!} onAtualizar={carregar} />)
            )}
          </div>
        </div>
      )}

      {modoAtivo === 'historico' && (
        <div style={s.stackVertical}>
          <div style={s.blocoRaia}>
            <div style={s.tituloRaia}>Propostas recusadas</div>
            {propostasExcluidas.length === 0
              ? <p style={s.vazio}>Nenhuma proposta arquivada.</p>
              : propostasExcluidas.map(o => <CardProposta key={o.id} orc={o} usuarioId={usuarioId!} onAtualizar={carregar} />)}
          </div>
          <div style={s.blocoRaia}>
            <div style={s.tituloRaia}>Serviços concluídos</div>
            {concluidos.length === 0
              ? <p style={s.vazio}>Nenhum serviço concluído ainda.</p>
              : concluidos.map(d => <CardServico key={d.id} demanda={d} usuarioId={usuarioId!} onAtualizar={carregar} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  titulo: { fontSize: '18px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '20px' },
  containerAbasChrome: { display: 'flex', borderBottom: '1px solid var(--border)', gap: '4px', marginBottom: '8px' },
  abaChrome: { padding: '10px 20px', background: 'none', border: 'none', borderBottom: '3px solid transparent', color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' },
  abaChromeAtiva: { borderBottomColor: 'var(--accent)', color: 'var(--text-h)' },
  vazio: { fontSize: '13px', color: 'var(--text)', fontStyle: 'italic', padding: '16px 0' },
  stackVertical: { display: 'flex', flexDirection: 'column', gap: '24px' },
  blocoRaia: { display: 'flex', flexDirection: 'column' },
  tituloRaia: { fontSize: '13px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', opacity: 0.8 },
};
