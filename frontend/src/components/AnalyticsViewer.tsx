import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/analytics.service';
import type { AnalyticsStats } from '../services/analytics.service';
import { BarChart3, Users, Eye, Activity, Download, Trash2 } from 'lucide-react';

const AnalyticsViewer: React.FC = () => {
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = () => {
        setStats(analyticsService.getStats());
    };

    const handleExport = () => {
        const data = analyticsService.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        if (confirm('¿Eliminar todos los datos de analytics?')) {
            analyticsService.clearData();
            loadStats();
        }
    };

    if (!stats) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 20,
            maxWidth: 400,
            maxHeight: '80vh',
            overflow: 'auto',
            zIndex: 9999,
            color: '#f8fafc'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={20} style={{ color: '#10b981' }} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Analytics</h3>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleExport} title="Exportar" style={{
                        padding: 6,
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 8,
                        color: '#3b82f6',
                        cursor: 'pointer'
                    }}>
                        <Download size={16} />
                    </button>
                    <button onClick={handleClear} title="Limpiar" style={{
                        padding: 6,
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 8,
                        color: '#ef4444',
                        cursor: 'pointer'
                    }}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{
                    padding: 12,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 12
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Activity size={16} style={{ color: '#10b981' }} />
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Total</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{stats.totalEvents}</div>
                </div>
                <div style={{
                    padding: 12,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: 12
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Eye size={16} style={{ color: '#3b82f6' }} />
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Páginas</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{stats.pageViews}</div>
                </div>
            </div>

            <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Users size={16} style={{ color: '#8b5cf6' }} />
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Uso por Rol</h4>
                </div>
                {Object.entries(stats.roleUsage).map(([role, count]) => (
                    <div key={role} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ fontSize: 13, color: '#cbd5e1' }}>{role}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{count}</span>
                    </div>
                ))}
            </div>

            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <BarChart3 size={16} style={{ color: '#f59e0b' }} />
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Páginas Más Visitadas</h4>
                </div>
                {stats.mostVisitedPages.slice(0, 5).map(({ page, count }) => (
                    <div key={page} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ fontSize: 13, color: '#cbd5e1' }}>{page}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>{count}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => setShowRaw(!showRaw)}
                style={{
                    marginTop: 16,
                    width: '100%',
                    padding: 10,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#cbd5e1',
                    fontSize: 13,
                    cursor: 'pointer'
                }}
            >
                {showRaw ? 'Ocultar' : 'Ver'} Eventos Recientes
            </button>

            {showRaw && (
                <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: 8,
                    maxHeight: 200,
                    overflow: 'auto'
                }}>
                    <pre style={{ margin: 0, fontSize: 10, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(stats.recentEvents.slice(0, 10), null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default AnalyticsViewer;
