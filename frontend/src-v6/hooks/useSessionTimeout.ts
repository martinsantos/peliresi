/**
 * SITREP v6 - Session Timeout Hook
 * =================================
 * Detects user inactivity and triggers automatic logout.
 * 30 min inactivity -> warning modal (60s countdown) -> logout.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 60 * 1000; // 60 seconds warning before logout

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click',
];

interface UseSessionTimeoutResult {
  showWarning: boolean;
  secondsLeft: number;
  dismissWarning: () => void;
}

export function useSessionTimeout(onLogout: () => void, enabled = true): UseSessionTimeoutResult {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    setShowWarning(false);
    setSecondsLeft(60);

    if (!enabled) return;

    // Set new inactivity timer
    inactivityTimer.current = setTimeout(() => {
      // Inactivity threshold reached — show warning
      setShowWarning(true);
      setSecondsLeft(WARNING_MS / 1000);

      // Start countdown
      countdownInterval.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto-logout after warning period
      warningTimer.current = setTimeout(() => {
        onLogout();
      }, WARNING_MS);
    }, INACTIVITY_MS);
  }, [enabled, onLogout]);

  const dismissWarning = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!enabled) return;

    resetTimers();

    const handleActivity = () => {
      // Only reset if warning is not showing (user must explicitly dismiss)
      if (!showWarning) {
        resetTimers();
      }
    };

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [enabled, resetTimers, showWarning]);

  return { showWarning, secondsLeft, dismissWarning };
}
