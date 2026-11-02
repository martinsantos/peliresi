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
import { SyntheticPreviewGate } from './components/SyntheticPreviewGate';
import './services/syntheticPreviewHeaders';
import './index.css';
import './styles/tokens-v2.css';
import './styles/synthetic-preview.css';

// ========================================
// RENDER
// ========================================
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SyntheticPreviewGate>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </SyntheticPreviewGate></React.StrictMode>
);
