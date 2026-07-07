/**
 * SubAbasPainel.tsx
 *
 * Sub-abas "Em andamento" / "Histórico" exibidas na sidebar, compartilhadas
 * pelas páginas Serviços e Solicitações, com labels e contadores próprios.
 */

export type ModoAbaPainel = 'andamento' | 'historico';

interface SubAbasPainelProps {
  modoAtivo: ModoAbaPainel;
  onMudarModo: (modo: ModoAbaPainel) => void;
  totalAndamento: number;
  totalHistorico: number;
  labelAndamento?: string;
  labelHistorico?: string;
}

/**
 * Par de botões de navegação entre os modos "andamento" e "histórico",
 * cada um exibindo um contador quando há itens.
 */
export default function SubAbasPainel({
  modoAtivo,
  onMudarModo,
  totalAndamento,
  totalHistorico,
  labelAndamento = 'Em andamento',
  labelHistorico = 'Histórico',
}: SubAbasPainelProps) {
  return (
    <div style={sb.container}>
      <button
        type="button"
        style={{ ...sb.item, ...(modoAtivo === 'andamento' ? sb.itemAtivo : {}) }}
        onClick={() => onMudarModo('andamento')}
      >
        <span>{labelAndamento}</span>
        {totalAndamento > 0 && <span style={sb.contador}>{totalAndamento}</span>}
      </button>
      <button
        type="button"
        style={{ ...sb.item, ...(modoAtivo === 'historico' ? sb.itemAtivo : {}) }}
        onClick={() => onMudarModo('historico')}
      >
        <span>{labelHistorico}</span>
        {totalHistorico > 0 && <span style={sb.contador}>{totalHistorico}</span>}
      </button>
    </div>
  );
}

const sb: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '4px' },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemAtivo: { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' },
  contador: {
    backgroundColor: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
  },
};
