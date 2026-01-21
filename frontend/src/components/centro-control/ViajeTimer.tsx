/**
 * ViajeTimer - Timer for active trips
 */

import React, { useState, useEffect } from 'react';
import { formatElapsedTime } from './utils';

interface ViajeTimerProps {
    initialSeconds: number;
    isPaused: boolean;
}

export const ViajeTimer: React.FC<ViajeTimerProps> = ({ initialSeconds, isPaused }) => {
    const [seconds, setSeconds] = useState(initialSeconds);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused]);

    // Sync with server when initialSeconds changes
    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    return <span className="viaje-timer-value">{formatElapsedTime(seconds)}</span>;
};

export default ViajeTimer;
