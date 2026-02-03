/**
 * SITREP v6 - Mobile PWA Entry Point
 * ===================================
 * Entry point para la PWA mobile en /app
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppMobile from './AppMobile';
import './index.css';
import './styles/tokens-v2.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <AppMobile />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
