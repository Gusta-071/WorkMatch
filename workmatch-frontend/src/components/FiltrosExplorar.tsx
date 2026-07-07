/**
 * FiltrosExplorar.tsx
 *
 * Painel de filtros da tela Explorar: um botão-gatilho que mostra quantos
 * filtros estão ativos e abre uma gaveta com seções colapsáveis
 * (Categorias, Habilidades, Orçamento, Métricas Mínimas). O estado dos
 * filtros é controlado pelo componente pai; este arquivo guarda apenas o
 * estado visual (menu aberto, seções expandidas, texto de busca).
 */

import { useState } from 'react';
import type { Categoria, NivelExperiencia } from '../types';
import { LABEL_NIVEL } from '../types';

// ─── Tipos e estado inicial ─────────────────────────────────────────────────

export interface FiltrosState {
  categoriasSelecionadas: number[];
  habilidadesSelecionadas: string[];
  matchMinimo: number;
  valorMin: number | null;
  valorMax: number | null;
  reputacaoMinimaPrestador: number;
  niveisSelecionados: NivelExperiencia[];
}

export const FILTROS_INICIAIS: FiltrosState = {
  categoriasSelecionadas: [],
  habilidadesSelecionadas: [],
  matchMinimo: 0,
  valorMin: null,
  valorMax: null,
  reputacaoMinimaPrestador: 0,
  niveisSelecionados: [],
};

interface FiltrosExplorarProps {
  categorias: Categoria[];
  filtros: FiltrosState;
  onMudar: (filtros: FiltrosState) => void;
}

const TODOS_NIVEIS: NivelExperiencia[] = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA'];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Remove acentos e normaliza para minúsculo, para busca de habilidades tolerante a acentuação. */
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Troca os espaços ao redor de "&" por espaço inseparável, evitando que o símbolo fique isolado ao quebrar linha. */
function evitarQuebraNoE(texto: string): string {
  return texto.replace(/ & /g, ' &\u00A0');
}

// ─── Componente principal ───────────────────────────────────────────────────

/**
 * Painel de filtros de busca da tela Explorar. Exibe o total de filtros
 * ativos no botão-gatilho e permite ajustar categorias, habilidades, faixa
 * de orçamento e métricas mínimas (match, reputação, nível de experiência).
 */
export default function FiltrosExplorar({ categorias, filtros, onMudar }: FiltrosExplorarProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaHabilidade, setBuscaHabilidade] = useState('');

  const [secaoAberta, setSecaoAberta] = useState<Record<string, boolean>>({
    categorias: true,
    habilidades: false,
    valores: false,
    requisitos: false,
  });

  const todasHabilidades = Array.from(
    new Set(categorias.flatMap(c => c.habilidades.map(h => h.nome)))
  ).sort();

  const habilidadesFiltradas = todasHabilidades.filter(h =>
    normalizarTexto(h).includes(normalizarTexto(buscaHabilidade))
  );

  /** Abre ou fecha uma seção colapsável pela sua chave. */
  const toggleSubsecao = (chave: string) => {
    setSecaoAberta(prev => ({ ...prev, [chave]: !prev[chave] }));
  };

  /** Adiciona ou remove uma categoria da seleção de filtros. */
  const alternarCategoria = (id: number) => {
    const atual = filtros.categoriasSelecionadas;
    onMudar({
      ...filtros,
      categoriasSelecionadas: atual.includes(id) ? atual.filter(c => c !== id) : [...atual, id],
    });
  };

  /** Adiciona ou remove uma habilidade da seleção de filtros. */
  const alternarHabilidade = (nome: string) => {
    const atual = filtros.habilidadesSelecionadas;
    onMudar({
      ...filtros,
      habilidadesSelecionadas: atual.includes(nome) ? atual.filter(h => h !== nome) : [...atual, nome],
    });
  };

  /** Adiciona ou remove um nível de experiência da seleção de filtros. */
  const alternarNivel = (nivel: NivelExperiencia) => {
    const atual = filtros.niveisSelecionados;
    onMudar({
      ...filtros,
      niveisSelecionados: atual.includes(nivel) ? atual.filter(n => n !== nivel) : [...atual, nivel],
    });
  };

  const totalFiltrosAtivos =
    filtros.categoriasSelecionadas.length +
    filtros.habilidadesSelecionadas.length +
    filtros.niveisSelecionados.length +
    (filtros.matchMinimo > 0 ? 1 : 0) +
    (filtros.valorMin !== null || filtros.valorMax !== null ? 1 : 0) +
    (filtros.reputacaoMinimaPrestador > 0 ? 1 : 0);

  return (
    <div style={styles.containerMenuIntegrado}>
      {/* Botão de gatilho: abre e fecha a gaveta de filtros */}
      <button
        type="button"
        style={{ ...styles.botaoFiltro, ...(menuAberto ? styles.botaoFiltroAtivo : {}) }}
        onClick={() => setMenuAberto(!menuAberto)}
      >
        <span>Opções de Filtro</span>
        <div style={styles.acoesBotaoFiltro}>
          {totalFiltrosAtivos > 0 && <span style={styles.contador}>{totalFiltrosAtivos}</span>}
          <span
            style={{
              ...styles.seta,
              transform: menuAberto ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Gaveta de filtros */}
      <div
        style={{
          ...styles.gavetaFiltros,
          maxHeight: menuAberto ? '900px' : '0px',
          opacity: menuAberto ? 1 : 0,
          pointerEvents: menuAberto ? 'auto' : 'none',
          paddingTop: menuAberto ? '8px' : '0px',
          paddingBottom: menuAberto ? '12px' : '0px',
        }}
      >
        <div style={styles.headerAcoes}>
          <button
            type="button"
            disabled={totalFiltrosAtivos === 0}
            style={{ ...styles.redefinirFiltros, ...(totalFiltrosAtivos > 0 ? styles.redefinirFiltrosAtivo : {}) }}
            onClick={() => totalFiltrosAtivos > 0 && onMudar(FILTROS_INICIAIS)}
          >
            Redefinir filtros
          </button>
        </div>

        <SecaoColapsavel
          titulo="Categorias"
          aberta={secaoAberta.categorias}
          onToggle={() => toggleSubsecao('categorias')}
        >
          {categorias.map(c => (
            <Checkbox
              key={c.id}
              label={c.nome}
              checked={filtros.categoriasSelecionadas.includes(c.id)}
              onChange={() => alternarCategoria(c.id)}
            />
          ))}
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Habilidades"
          aberta={secaoAberta.habilidades}
          onToggle={() => toggleSubsecao('habilidades')}
        >
          <input
            type="text"
            placeholder="Buscar habilidade..."
            value={buscaHabilidade}
            onChange={e => setBuscaHabilidade(e.target.value)}
            style={styles.inputBuscaHabilidade}
          />
          <div style={styles.containerTags}>
            {habilidadesFiltradas.length === 0 ? (
              <span style={styles.vazioHabilidades}>Nenhuma encontrada</span>
            ) : (
              habilidadesFiltradas.map(h => {
                const ativo = filtros.habilidadesSelecionadas.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => alternarHabilidade(h)}
                    style={ativo ? styles.tagAtiva : styles.tagInativa}
                  >
                    {h}
                  </button>
                );
              })
            )}
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Orçamento"
          aberta={secaoAberta.valores}
          onToggle={() => toggleSubsecao('valores')}
        >
          <div style={styles.faixaValor}>
            <div style={styles.wrapperInputMoeda}>
              <span style={styles.prefixoMoeda}>R$</span>
              <input
                type="number"
                placeholder="Mín."
                value={filtros.valorMin ?? ''}
                onChange={e => onMudar({ ...filtros, valorMin: e.target.value ? Number(e.target.value) : null })}
                style={styles.inputPequeno}
              />
            </div>
            <div style={styles.wrapperInputMoeda}>
              <span style={styles.prefixoMoeda}>R$</span>
              <input
                type="number"
                placeholder="Máx."
                value={filtros.valorMax ?? ''}
                onChange={e => onMudar({ ...filtros, valorMax: e.target.value ? Number(e.target.value) : null })}
                style={styles.inputPequeno}
              />
            </div>
          </div>
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Métricas Mínimas"
          aberta={secaoAberta.requisitos}
          onToggle={() => toggleSubsecao('requisitos')}
        >
          <div style={styles.blocoRange}>
            <div style={styles.labelsRange}>
              <span>Match Mínimo</span>
              <span style={styles.valorDestaqueRange}>{filtros.matchMinimo}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={filtros.matchMinimo}
              onChange={e => onMudar({ ...filtros, matchMinimo: Number(e.target.value) })}
              style={styles.slider}
            />
          </div>

          <div style={{ ...styles.blocoRange, marginTop: '10px' }}>
            <div style={styles.labelsRange}>
              <span>Reputação mínima</span>
              <span style={styles.valorDestaqueRange}>{filtros.reputacaoMinimaPrestador.toFixed(1)} / 5</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={filtros.reputacaoMinimaPrestador}
              onChange={e => onMudar({ ...filtros, reputacaoMinimaPrestador: Number(e.target.value) })}
              style={styles.slider}
            />
          </div>

          <div style={{ marginTop: '12px' }}>
            <span style={styles.rotuloInterno}>Experiência</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
              {TODOS_NIVEIS.map(n => (
                <Checkbox
                  key={n}
                  label={LABEL_NIVEL[n]}
                  checked={filtros.niveisSelecionados.includes(n)}
                  onChange={() => alternarNivel(n)}
                />
              ))}
            </div>
          </div>
        </SecaoColapsavel>
      </div>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

/**
 * Seção colapsável usada dentro da gaveta de filtros, com cabeçalho no
 * mesmo estilo de item plano do SubAbasPainel (estado aberto = estado ativo).
 */
function SecaoColapsavel({
  titulo,
  aberta,
  onToggle,
  children,
}: {
  titulo: string;
  aberta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.cardSecao}>
      <button
        type="button"
        onClick={onToggle}
        style={{ ...styles.headerSecao, ...(aberta ? styles.headerSecaoAtiva : {}) }}
      >
        <span style={styles.secaoTitulo}>{titulo}</span>
        <span style={{ ...styles.seta, transform: aberta ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      <div
        style={{
          ...styles.conteudoColapsavel,
          maxHeight: aberta ? '220px' : '0px',
          opacity: aberta ? 1 : 0,
          paddingTop: aberta ? '8px' : '0px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Checkbox padrão usado nas seções de filtro (categorias e níveis de experiência). */
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={styles.checkboxLabel}>
      <input type="checkbox" checked={checked} onChange={onChange} style={styles.inputCheckReal} />
      <span style={styles.textoCheck}>{evitarQuebraNoE(label)}</span>
    </label>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  containerMenuIntegrado: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    boxSizing: 'border-box',
  },

  botaoFiltro: {
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
    width: '100%',
    boxSizing: 'border-box',
  },
  botaoFiltroAtivo: {
    backgroundColor: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderRadius: '8px 8px 0 0',
  },
  acoesBotaoFiltro: { display: 'flex', alignItems: 'center', gap: '8px' },
  seta: { fontSize: '9px', transition: 'transform 0.2s ease' },

  contador: {
    backgroundColor: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
  },

  gavetaFiltros: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderTop: 'none',
    borderRadius: '0 0 8px 8px',
    padding: '0 10px',
    overflowY: 'hidden',
    overflowX: 'hidden',
    transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
    boxSizing: 'border-box',
  },
  headerAcoes: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: '10px 4px 6px 4px',
    borderBottom: '1px dashed var(--border)',
  },

  redefinirFiltros: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text)',
    opacity: 0.4,
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'default',
    transition: 'color 0.15s ease, opacity 0.15s ease',
  },
  redefinirFiltrosAtivo: {
    color: '#ef4444',
    opacity: 1,
    cursor: 'pointer',
  },

  cardSecao: { display: 'flex', flexDirection: 'column' },

  headerSecao: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    width: '100%',
    padding: '8px 6px',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  headerSecaoAtiva: { backgroundColor: 'var(--accent-bg)' },
  secaoTitulo: { fontSize: '12px', fontWeight: 700, color: 'var(--text-h)', letterSpacing: '0.2px' },
  conteudoColapsavel: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 6px',
    transition: 'max-height 0.2s ease-out, opacity 0.15s ease',
  },

  inputBuscaHabilidade: {
    width: '100%',
    padding: '5px 8px',
    fontSize: '11px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    color: 'var(--text-h)',
    marginBottom: '6px',
    boxSizing: 'border-box',
  },
  vazioHabilidades: { fontSize: '11px', color: 'var(--text)', opacity: 0.5, padding: '4px 2px', fontStyle: 'italic' },

  checkboxLabel: { display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', padding: '2px 0' },
  inputCheckReal: { cursor: 'pointer', width: '12px', height: '12px', marginTop: '2px', flexShrink: 0, accentColor: 'var(--accent)' },
  textoCheck: { fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 },

  containerTags: { display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '2px 0' },
  tagInativa: {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tagAtiva: {
    backgroundColor: 'var(--accent-bg)',
    color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
    borderRadius: '999px',
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  faixaValor: { display: 'flex', gap: '6px', marginTop: '2px' },
  wrapperInputMoeda: { position: 'relative', display: 'flex', alignItems: 'center', width: '50%' },
  prefixoMoeda: { position: 'absolute', left: '6px', fontSize: '10px', color: 'var(--text)', opacity: 0.6, pointerEvents: 'none' },
  inputPequeno: { width: '100%', padding: '5px 5px 5px 20px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text-h)', boxSizing: 'border-box' },

  blocoRange: { display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' },
  labelsRange: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text)' },
  valorDestaqueRange: { fontWeight: 600, color: 'var(--accent)' },
  slider: { width: '90%', margin: '4px auto', height: '3px', accentColor: 'var(--accent)', cursor: 'pointer' },
  rotuloInterno: { fontSize: '10px', fontWeight: 600, color: 'var(--text)' },
};
