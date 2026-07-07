/**
 * App.tsx
 *
 * Raiz de rotas da aplicação: Login na rota pública e o painel principal
 * (Layout) protegido, exigindo usuário autenticado no localStorage.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './layouts/Layout';

/** Verifica se há um usuário salvo no localStorage (sessão ativa). */
function isLoggedIn(): boolean {
  return !!localStorage.getItem('@WorkMatch:user');
}

/** Configura as rotas da aplicação e o redirecionamento para usuários não autenticados. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/app"
          element={isLoggedIn() ? <Layout /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
