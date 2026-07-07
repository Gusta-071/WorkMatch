/**
 * main.tsx
 *
 * Ponto de entrada da aplicação: monta o componente raiz (App) no DOM.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
