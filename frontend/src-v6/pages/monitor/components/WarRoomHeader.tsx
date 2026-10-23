/**
 * WarRoomHeader — Top bar with logo, mode selector, clock, controls
 */

import React, { useState, useEffect } from 'react';
import { Radio, History, CalendarClock, Film, X } from 'lucide-react';
import { SitrepMark, SitrepWordmark } from '../../../components/SitrepMark';
import type { MonitorMode } from '../WarRoomPage';
import { formatTime } from '../utils/formatters';

interface Props {
  mode: MonitorMode;
  cinemaMode: boolean;
  onModeChange: (mode: MonitorMode) => void;
  onCinemaToggle: () => void;
  onClose: () => void;
  liveCurrent?: boolean;
}

export const WarRoomHeader: React.FC<Props> = ({ mode, cinemaMode, onModeChange, onCinemaToggle, onClose, liveCurrent = false }) => {
  const [clock, setClock] = useState(formatTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => setClock(formatTime(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="wr-header flex items-center justify-between px-4 py-2 bg-white text-primary-800 border-b border-neutral-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center">
          <SitrepMark size={26} />
        </div>
        <SitrepWordmark className="text-base font-bold tracking-tight" />
        <span className="text-sm text-primary-800 hidden sm:inline">Monitor</span>
      </div>

      {/* Mode selector */}
      <div className="wr-mode-selector flex items-center gap-1 rounded-lg p-1" role="group" aria-label="Modo del Monitor">
        <button
          onClick={() => onModeChange('LIVE')}
          aria-pressed={mode === 'LIVE'}
          className={`flex items-center gap-2 px-3 min-h-11 rounded-md text-sm font-semibold transition-colors ${
            mode === 'LIVE' ? 'bg-primary-800 text-white' : 'text-primary-800 hover:bg-primary-50'
          }`}
        >
          {mode === 'LIVE' && liveCurrent && <span className="wr-live-dot" aria-hidden="true" />}
          <Radio size={16} />
          En vivo
        </button>
        <button
          onClick={() => onModeChange('PLAYBACK')}
          aria-pressed={mode === 'PLAYBACK'}
          className={`flex items-center gap-2 px-3 min-h-11 rounded-md text-sm font-semibold transition-colors ${
            mode === 'PLAYBACK' ? 'bg-primary-800 text-white' : 'text-primary-800 hover:bg-primary-50'
          }`}
        >
          <History size={16} />
          Historial
        </button>
        <button
          onClick={() => onModeChange('FORECAST')}
          aria-pressed={mode === 'FORECAST'}
          className={`flex items-center gap-2 px-3 min-h-11 rounded-md text-sm font-semibold transition-colors ${
            mode === 'FORECAST' ? 'bg-primary-800 text-white' : 'text-primary-800 hover:bg-primary-50'
          }`}
        >
          <CalendarClock size={16} />
          Pendientes
        </button>
      </div>

      {/* Right controls */}
      <div className="wr-header-tools flex items-center gap-3">
        <span className="wr-clock font-mono text-sm text-neutral-600 tabular-nums">{clock}</span>
        <button
          onClick={onCinemaToggle}
          className={`min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors ${cinemaMode ? 'bg-primary-800 text-white' : 'text-primary-800 hover:bg-primary-50'}`}
          aria-pressed={cinemaMode}
          title="Modo mapa oscuro (C)"
        >
          <Film size={16} />
        </button>
        <button
          onClick={onClose}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-primary-800 hover:bg-primary-50 transition-colors"
          title="Cerrar (Esc)"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
};
