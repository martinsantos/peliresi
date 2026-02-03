/**
 * SITREP v6 - Entry Point
 * =======================
 * Punto de entrada de la aplicación React
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './styles/tokens-v2.css';

// ========================================
// REACT QUERY CLIENT
// ========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ========================================
// RENDER
// ========================================
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
