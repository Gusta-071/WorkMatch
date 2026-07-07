/**
 * Layout.tsx
 *
 * Estrutura principal da aplicação: sidebar de navegação + área de conteúdo,
 * alternando entre as páginas (Explorar, Solicitações, Serviços, Perfil)
 * conforme a aba selecionada.
 */

import { useState, type ReactNode } from 'react';
import Sidebar, { type AbaPainel } from './Sidebar';
import { SubpainelProvider } from './SubpainelContext';
import Explorar from '../pages/Explorar';
import Solicitacoes from '../pages/Solicitacoes';
import Servicos from '../pages/Servicos';
import Perfil from '../pages/Perfil';

/**
 * Componente raiz do painel logado. Controla a aba ativa e o subpainel
 * exibido na sidebar, e renderiza a página correspondente à aba selecionada.
 */
export default function Layout() {
  const [abaAtiva, setAbaAtiva] = useState<AbaPainel>('explorar');
  const [subpainel, setSubpainel] = useState<ReactNode | null>(null);

  const usuarioSalvo = localStorage.getItem('@WorkMatch:user');
  const usuario = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;

  return (
    <div style={styles.container} className="wm-container">
      <SubpainelProvider onMudar={setSubpainel}>
        <Sidebar
          abaAtiva={abaAtiva}
          onSelecionarAba={setAbaAtiva}
          subpainel={subpainel}
          nomeUsuario={usuario?.nome}
        />
        <main style={styles.conteudo} className="wm-conteudo">
          {abaAtiva === 'explorar' && <Explorar usuarioId={usuario?.id} />}
          {abaAtiva === 'solicitacoes' && <Solicitacoes usuarioId={usuario?.id} />}
          {abaAtiva === 'servicos' && <Servicos usuarioId={usuario?.id} />}
          {abaAtiva === 'perfil' && <Perfil usuarioId={usuario?.id} />}
        </main>
      </SubpainelProvider>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--bg)',
  },
  conteudo: {
    flexGrow: 1,
    padding: '32px 40px',
    overflowY: 'auto',
  },
};
