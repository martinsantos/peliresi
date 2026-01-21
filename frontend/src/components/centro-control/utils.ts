/**
 * Utility functions for CentroControl
 */

import type { ChartDataPoint } from '../ui';
import type { Actividad } from '../../services/admin.service';
import type { SystemStats } from './types';

/**
 * Generate chart data for activity visualization
 */
export function generateActivityChartData(actividades: Actividad[]): ChartDataPoint[] {
    const hours: Record<string, number> = {};
    const now = new Date();

    // Initialize last 8 hours
    for (let i = 7; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 3600000);
        const key = hour.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        hours[key] = 0;
    }

    // Count activities per hour
    actividades.forEach(act => {
        const actDate = new Date(act.fecha);
        const diffHours = (now.getTime() - actDate.getTime()) / 3600000;
        if (diffHours <= 8) {
            const key = actDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            if (hours[key] !== undefined) {
                hours[key]++;
            }
        }
    });

    return Object.entries(hours).map(([name, value]) => ({ name, value }));
}

/**
 * Generate pipeline chart data from system stats
 */
export function generatePipelineChartData(stats: SystemStats): ChartDataPoint[] {
    return [
        { name: 'Borradores', value: stats.manifiestos.borradores },
        { name: 'Aprobados', value: stats.manifiestos.aprobados },
        { name: 'En Tránsito', value: stats.manifiestos.enTransito },
        { name: 'Entregados', value: stats.manifiestos.entregados },
        { name: 'Recibidos', value: stats.manifiestos.recibidos },
        { name: 'Tratados', value: stats.manifiestos.tratados },
    ].filter(item => item.value > 0);
}

/**
 * Format relative time string
 */
export function formatRelativeTime(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/**
 * Format elapsed seconds to HH:MM:SS
 */
export function formatElapsedTime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
