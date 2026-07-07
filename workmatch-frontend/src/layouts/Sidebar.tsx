/**
 * Sidebar.tsx
 *
 * Menu lateral de navegação entre as páginas principais. Cada item pode
 * exibir um subpainel próprio (gaveta) que permanece visível durante a
 * transição de fechamento, evitando que o conteúdo suma abruptamente.
 */

import { useState, useEffect, type ReactNode } from 'react';

export type AbaPainel = 'explorar' | 'solicitacoes' | 'servicos' | 'perfil';

interface ItemSidebar {
  id: AbaPainel;
  label: string;
  icone: string;
}

const ITENS: ItemSidebar[] = [
  { id: 'explorar', label: 'Explorar', icone: '' },
  { id: 'solicitacoes', label: 'Solicitações', icone: '' },
  { id: 'servicos', label: 'Serviços', icone: '' },
  { id: 'perfil', label: 'Perfil', icone: '' },
];

interface SidebarProps {
  abaAtiva: AbaPainel;
  onSelecionarAba: (aba: AbaPainel) => void;
  subpainel?: ReactNode;
  nomeUsuario?: string;
}

/**
 * Menu lateral com os itens de navegação e a gaveta de subpainel da aba
 * ativa. O último subpainel exibido fica memorizado para que a animação de
 * fechamento não deixe a gaveta vazia antes de recolher.
 */
export default function Sidebar({ abaAtiva, onSelecionarAba, subpainel, nomeUsuario }: SidebarProps) {
  const [subpainelMemorizado, setSubpainelMemorizado] = useState<ReactNode | null>(null);
  const [ultimaAbaComSubpainel, setUltimaAbaComSubpainel] = useState<AbaPainel | null>(null);

  useEffect(() => {
    if (subpainel) {
      setSubpainelMemorizado(subpainel);
      setUltimaAbaComSubpainel(abaAtiva);
    }
  }, [subpainel, abaAtiva]);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.topo}>
        <span style={styles.logo}>WorkMatch</span>
        {nomeUsuario && <span style={styles.usuario}>{nomeUsuario}</span>}
      </div>

      <nav style={styles.nav}>
        {ITENS.map(item => {
          // Define se a gaveta deste item deve estar aberta.
          const estaAberto = abaAtiva === item.id && !!subpainel;

          // Escolhe o conteúdo a exibir: o atual, ou o memorizado enquanto a gaveta fecha.
          const conteudoExibir = abaAtiva === item.id 
            ? subpainel 
            : (ultimaAbaComSubpainel === item.id ? subpainelMemorizado : null);

          return (
            <div key={item.id}>
              <button
                onClick={() => onSelecionarAba(item.id)}
                style={{
                  ...styles.itemBotao,
                  ...(abaAtiva === item.id ? styles.itemAtivo : {}),
                }}
              >
                <span style={styles.icone}>{item.icone}</span>
                {item.label}
              </button>

              {/* Gaveta do subpainel: permanece no DOM e anima altura/opacidade */}
              <div style={{
                ...styles.subpainelGaveta,
                maxHeight: estaAberto ? '1000px' : '0px',
                opacity: estaAberto ? 1 : 0,
                marginTop: estaAberto ? '6px' : '0px',
                marginBottom: estaAberto ? '10px' : '0px',
                paddingLeft: estaAberto ? '12px' : '0px',
                pointerEvents: estaAberto ? 'auto' : 'none',
              }}>
                {conteudoExibir}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        style={styles.sair}
        onClick={() => {
          localStorage.removeItem('@WorkMatch:user');
          window.location.href = '/';
        }}
      >
        Sair
      </button>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '240px',
    minWidth: '240px',
    backgroundColor: 'var(--bg)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    boxSizing: 'border-box',
  },
  topo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '32px',
    paddingLeft: '8px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '-0.5px',
  },
  usuario: {
    fontSize: '13px',
    color: 'var(--text)',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexGrow: 1,
  },
  itemBotao: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-h)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  itemAtivo: {
    backgroundColor: 'var(--accent-bg)',
    color: 'var(--accent)',
  },
  icone: {
    fontSize: '16px',
  },
  subpainelGaveta: {
    marginLeft: '12px',
    borderLeft: '2px solid var(--accent-border)',
    overflow: 'hidden',
    transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, margin 0.3s ease, padding 0.3s ease',
  },
  sair: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    padding: '10px 12px',
  },
};
