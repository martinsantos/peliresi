/**
 * Tests for KPICards component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPICards } from '../KPICards'
import type { SystemStats } from '../types'

const mockStats: SystemStats = {
    manifiestos: {
        total: 1234,
        borradores: 50,
        aprobados: 100,
        enTransito: 75,
        entregados: 200,
        recibidos: 400,
        tratados: 409,
    },
    usuarios: {
        total: 100,
        activos: 85,
        pendientes: 5,
        porRol: {
            ADMIN: 3,
            GENERADOR: 40,
            TRANSPORTISTA: 30,
            OPERADOR: 12,
        },
    },
    alertasActivas: 3,
    eventosHoy: 42,
}

const mockTendencia = {
    manifiestos: 12.5,
    residuos: 8.3,
}

describe('KPICards', () => {
    it('should render manifiestos total', () => {
        render(<KPICards stats={mockStats} tendencia={mockTendencia} />)

        expect(screen.getByText('1.234')).toBeInTheDocument()
        expect(screen.getByText('MANIFIESTOS')).toBeInTheDocument()
    })

    it('should render vehicles in transit', () => {
        render(<KPICards stats={mockStats} tendencia={mockTendencia} />)

        expect(screen.getByText('75')).toBeInTheDocument()
        expect(screen.getByText('EN RUTA')).toBeInTheDocument()
    })

    it('should render alerts count', () => {
        render(<KPICards stats={mockStats} tendencia={mockTendencia} />)

        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('ALERTAS')).toBeInTheDocument()
        expect(screen.getByText('Revisar')).toBeInTheDocument()
    })

    it('should render active users', () => {
        render(<KPICards stats={mockStats} tendencia={mockTendencia} />)

        expect(screen.getByText('85')).toBeInTheDocument()
        expect(screen.getByText('USUARIOS')).toBeInTheDocument()
    })

    it('should show pending users badge when there are pending users', () => {
        render(<KPICards stats={mockStats} tendencia={mockTendencia} />)

        expect(screen.getByText('5 pendientes')).toBeInTheDocument()
    })

    it('should not show pending users badge when there are no pending users', () => {
        const statsNoPending = {
            ...mockStats,
            usuarios: { ...mockStats.usuarios, pendientes: 0 }
        }

        render(<KPICards stats={statsNoPending} tendencia={mockTendencia} />)

        expect(screen.queryByText(/pendientes/)).not.toBeInTheDocument()
    })

    it('should show positive trend with plus sign', () => {
        render(<KPICards stats={mockStats} tendencia={mockTendencia} />)

        expect(screen.getByText(/\+12\.5%/)).toBeInTheDocument()
    })

    it('should show negative trend without plus sign', () => {
        const negativeTendencia = { manifiestos: -5.2, residuos: -3.1 }

        render(<KPICards stats={mockStats} tendencia={negativeTendencia} />)

        expect(screen.getByText(/-5\.2%/)).toBeInTheDocument()
    })

    it('should not show alerts badge when no alerts', () => {
        const statsNoAlerts = { ...mockStats, alertasActivas: 0 }

        render(<KPICards stats={statsNoAlerts} tendencia={mockTendencia} />)

        expect(screen.queryByText('Revisar')).not.toBeInTheDocument()
    })
})
