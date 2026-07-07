/**
 * ModalAvaliacao.tsx
 *
 * Modal genérico de avaliação por estrelas (1 a 5), usado tanto para o
 * cliente avaliar o prestador quanto o prestador avaliar o cliente.
 */

import { useState } from 'react';

interface ModalAvaliacaoProps {
  titulo: string;
  descricao?: string;
  enviando?: boolean;
  aoConfirmar: (nota: number) => void;
  aoFechar: () => void;
}

/**
 * Modal com seleção de nota em estrelas e ações de confirmar ou adiar a
 * avaliação. Fecha ao clicar fora da caixa (no overlay).
 */
export default function ModalAvaliacao({ titulo, descricao, enviando, aoConfirmar, aoFechar }: ModalAvaliacaoProps) {
  const [nota, setNota] = useState(5);

  return (
    <div style={ma.overlay} onClick={aoFechar}>
      <div style={ma.caixa} onClick={e => e.stopPropagation()}>
        <h3 style={ma.titulo}>{titulo}</h3>
        {descricao && <p style={ma.descricao}>{descricao}</p>}

        <div style={ma.estrelas}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              style={{ ...ma.estrela, opacity: n <= nota ? 1 : 0.3 }}
            >
              ★
            </button>
          ))}
        </div>

        <div style={ma.acoes}>
          <button style={ma.btnSecundario} onClick={aoFechar}>Avaliar depois</button>
          <button style={ma.btnPrimario} disabled={enviando} onClick={() => aoConfirmar(nota)}>
            {enviando ? 'Enviando...' : 'Confirmar avaliação'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ma: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  caixa: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '320px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '16px' },
  titulo: { fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', margin: 0 },
  descricao: { fontSize: '13px', color: 'var(--text)', margin: 0 },
  estrelas: { display: 'flex', gap: '6px', justifyContent: 'center', fontSize: '30px' },
  estrela: { background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 0, lineHeight: 1 },
  acoes: { display: 'flex', justifyContent: 'space-between', gap: '8px' },
  btnPrimario: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', flex: 1 },
  btnSecundario: { backgroundColor: 'var(--border)', color: 'var(--text-h)', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
};
