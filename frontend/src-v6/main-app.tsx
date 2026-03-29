/**
 * SITREP v6 - Mobile PWA Entry Point
 * ===================================
 * Entry point para la PWA mobile en /app
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import AppMobile from './AppMobile';
import './index.css';
import './styles/tokens-v2.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter basename="/app">
      <AppMobile />
    </BrowserRouter>
  </QueryClientProvider>
);
