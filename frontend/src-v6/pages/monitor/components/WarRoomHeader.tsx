/**
 * WarRoomHeader — Top bar with logo, mode selector, clock, controls
 */

import React, { useState, useEffect } from 'react';
import { Leaf, Radio, Play, Eye, Film, X } from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import { formatTime } from '../utils/formatters';

interface Props {
  mode: MonitorMode;
  cinemaMode: boolean;
  onModeChange: (mode: MonitorMode) => void;
  onCinemaToggle: () => void;
  onClose: () => void;
}

export const WarRoomHeader: React.FC<Props> = ({ mode, cinemaMode, onModeChange, onCinemaToggle, onClose }) => {
  const [clock, setClock] = useState(formatTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => setClock(formatTime(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className={`flex items-center justify-between px-4 py-2.5 ${cinemaMode ? 'bg-neutral-900/95 border-b border-white/10' : 'bg-[#1B5E3C] text-white'}`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <Leaf size={18} className="text-white" />
        </div>
        <span className="text-base font-bold tracking-tight text-white">SITREP</span>
        <span className="text-xs font-light text-white/60 hidden sm:inline">Monitor</span>
      </div>

      {/* Mode selector */}
      <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
        <button
          onClick={() => onModeChange('LIVE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            mode === 'LIVE' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white/80'
          }`}
        >
          {mode === 'LIVE' && <span className="wr-live-dot" />}
          <Radio size={13} />
          LIVE
        </button>
        <button
          onClick={() => onModeChange('PLAYBACK')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            mode === 'PLAYBACK' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white/80'
          }`}
        >
          <Play size={13} />
          PLAYBACK
        </button>
        <button
          onClick={() => onModeChange('FORECAST')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            mode === 'FORECAST' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white/80'
          }`}
        >
          <Eye size={13} />
          FORECAST
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-white/80 tabular-nums">{clock}</span>
        <button
          onClick={onCinemaToggle}
          className={`p-1.5 rounded-lg transition-all ${cinemaMode ? 'bg-amber-500/20 text-amber-300' : 'text-white/60 hover:text-white/80 hover:bg-white/10'}`}
          title="Cinema mode (C)"
        >
          <Film size={16} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
          title="Cerrar (Esc)"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
};
