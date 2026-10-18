/**
 * WarRoomHeader — Top bar with logo, mode selector, clock, controls
 */

import React, { useState, useEffect } from 'react';
import { Radio, History, CalendarClock, Film, X } from 'lucide-react';
import { SitrepMark } from '../../../components/SitrepMark';
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
    <header className="wr-header flex items-center justify-between px-4 py-2 bg-[#1B5E3C] text-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
          <SitrepMark size={26} />
        </div>
        <span className="text-base font-bold tracking-tight text-white">SITREP</span>
        <span className="text-sm text-white hidden sm:inline">Monitor</span>
      </div>

      {/* Mode selector */}
      <div className="wr-mode-selector flex items-center gap-1 rounded-lg p-1" role="group" aria-label="Modo del Monitor">
        <button
          onClick={() => onModeChange('LIVE')}
          aria-pressed={mode === 'LIVE'}
          className={`flex items-center gap-2 px-3 min-h-11 rounded-md text-sm font-semibold transition-colors ${
            mode === 'LIVE' ? 'bg-white text-[#1B5E3C]' : 'text-white hover:bg-white/15'
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
            mode === 'PLAYBACK' ? 'bg-white text-[#1B5E3C]' : 'text-white hover:bg-white/15'
          }`}
        >
          <History size={16} />
          Historial
        </button>
        <button
          onClick={() => onModeChange('FORECAST')}
          aria-pressed={mode === 'FORECAST'}
          className={`flex items-center gap-2 px-3 min-h-11 rounded-md text-sm font-semibold transition-colors ${
            mode === 'FORECAST' ? 'bg-white text-[#1B5E3C]' : 'text-white hover:bg-white/15'
          }`}
        >
          <CalendarClock size={16} />
          Pendientes
        </button>
      </div>

      {/* Right controls */}
      <div className="wr-header-tools flex items-center gap-3">
        <span className="wr-clock font-mono text-sm text-white/80 tabular-nums">{clock}</span>
        <button
          onClick={onCinemaToggle}
          className={`min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors ${cinemaMode ? 'bg-white text-[#1B5E3C]' : 'text-white hover:bg-white/15'}`}
          aria-pressed={cinemaMode}
          title="Modo mapa oscuro (C)"
        >
          <Film size={16} />
        </button>
        <button
          onClick={onClose}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors"
          title="Cerrar (Esc)"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
};
