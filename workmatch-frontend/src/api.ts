/**
 * api.ts
 *
 * Instância única do Axios usada por toda a aplicação para chamadas à API.
 */

import axios from 'axios';

/**
 * URL base do backend.
 * - Em desenvolvimento (npm run dev): usa localhost automaticamente.
 * - Em produção: definida pela env var VITE_API_URL (configurada no Vercel/Netlify).
 */
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Cliente HTTP configurado com a URL base do backend. */
export const api = axios.create({
  baseURL,
});