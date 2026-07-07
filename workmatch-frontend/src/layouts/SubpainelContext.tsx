/**
 * SubpainelContext.tsx
 *
 * Contexto que permite a qualquer página injetar conteúdo (subpainel) na
 * sidebar, sem que a Sidebar precise conhecer os detalhes de cada página.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface SubpainelContextValue {
  definirSubpainel: (conteudo: ReactNode | null) => void;
}

const SubpainelContext = createContext<SubpainelContextValue>({
  definirSubpainel: () => {},
});

/**
 * Hook usado pelas páginas para publicar seu subpainel na sidebar. O
 * conteúdo é atualizado a cada mudança e removido automaticamente quando
 * o componente que o declarou é desmontado.
 */
export function useSubpainelSidebar(conteudo: ReactNode | null) {
  const { definirSubpainel } = useContext(SubpainelContext);

  useEffect(() => {
    definirSubpainel(conteudo);
    return () => definirSubpainel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo]);
}

/**
 * Provider do contexto de subpainel. Repassa a função de atualização
 * (`onMudar`) fornecida pelo Layout para os consumidores do hook.
 */
export function SubpainelProvider({
  children,
  onMudar,
}: {
  children: ReactNode;
  onMudar: (conteudo: ReactNode | null) => void;
}) {
  return (
    <SubpainelContext.Provider value={{ definirSubpainel: onMudar }}>
      {children}
    </SubpainelContext.Provider>
  );
}
