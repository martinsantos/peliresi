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
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error: unknown) => {
        if (failureCount >= 2) return false;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status < 500) return false; // No retry on 4xx
        return true; // Retry 5xx and network errors
      },
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
