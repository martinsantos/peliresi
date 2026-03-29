/**
 * SITREP v6 - Entry Point
 * =======================
 * Punto de entrada de la aplicación React
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import App from './App';
import './index.css';
import './styles/tokens-v2.css';

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
