// Analytics Middleware - Tracks all API requests for superadmin stats
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { AuthRequest } from './auth.middleware';

interface AnalyticsData {
    timestamp: Date;
    method: string;
    path: string;
    userAgent: string;
    ip: string;
    userId?: string;
    userEmail?: string;
    statusCode: number;
    responseTime: number;
    query?: string;
    body?: string;
}

// In-memory buffer for batch inserts
const analyticsBuffer: AnalyticsData[] = [];
const BUFFER_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 seconds

// Flush buffer to database
async function flushAnalyticsBuffer() {
    if (analyticsBuffer.length === 0) return;

    const dataToInsert = [...analyticsBuffer];
    analyticsBuffer.length = 0;

    try {
        await prisma.analyticsLog.createMany({
            data: dataToInsert.map(d => ({
                timestamp: d.timestamp,
                method: d.method,
                path: d.path,
                userAgent: d.userAgent,
                ipAddress: d.ip,
                userId: d.userId,
                userEmail: d.userEmail,
                statusCode: d.statusCode,
                responseTimeMs: d.responseTime,
                queryParams: d.query,
                requestBody: d.body
            }))
        });
    } catch (error) {
        logger.error({ err: error }, 'Error flushing analytics');
        // Re-add failed entries (up to buffer size)
        analyticsBuffer.push(...dataToInsert.slice(0, BUFFER_SIZE));
    }
}

// Start periodic flush
setInterval(flushAnalyticsBuffer, FLUSH_INTERVAL);

// High-frequency GPS routes to skip — ~100 writes/min unnecessary at 50 transportistas
const SKIP_ANALYTICS_PATHS = ['/ubicacion', '/gps'];
// Document bodies can contain CUIT, DNI, tax references, OCR text and file
// metadata. Analytics is for operational metrics, not a document archive.
const SKIP_BODY_ANALYTICS_PATHS = [
    '/solicitudes',
    '/documentos',
    '/comprobantes-atm',
    '/credenciales',
    '/certificados',
];

// Middleware
export const analyticsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // M2: Skip analytics for GPS routes to reduce DB write pressure
    if (SKIP_ANALYTICS_PATHS.some(p => req.path.includes(p))) {
        return next();
    }

    const startTime = Date.now();

    // Capture response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        // Get user info from request (set by auth middleware)
        const user = (req as AuthRequest).user;

        const analyticsData: AnalyticsData = {
            timestamp: new Date(),
            method: req.method,
            path: req.path,
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.ip || req.socket.remoteAddress || 'unknown',
            userId: user?.id,
            userEmail: user?.email,
            statusCode: res.statusCode,
            responseTime: duration,
            query: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : undefined,
            // Only log body for certain methods, sanitize sensitive data
            body: ['POST', 'PUT', 'PATCH'].includes(req.method)
                && !req.path.includes('login')
                && !SKIP_BODY_ANALYTICS_PATHS.some(p => req.path.includes(p))
                ? JSON.stringify(sanitizeBodyForAnalytics(req.body)).substring(0, 500)
                : undefined
        };

        analyticsBuffer.push(analyticsData);

        // Flush if buffer is full
        if (analyticsBuffer.length >= BUFFER_SIZE) {
            flushAnalyticsBuffer();
        }
    });

    next();
};

// Sanitize sensitive data from request body
export function sanitizeBodyForAnalytics(body: any): any {
    if (!body) return body;
    if (typeof body !== 'object') return '[REDACTED]';
    const sensitiveKeys = [
        'password', 'token', 'secret', 'credential', 'datosactor',
        'datosformulario', 'datosregulatorio', 'datosresiduos', 'datostef',
        'ocr', 'archivo', 'file', 'cuit', 'dni', 'licencia', 'telefono',
        'domicilio', 'email', 'referencia',
    ];
    const sanitize = (value: unknown, key = ''): unknown => {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) return '[REDACTED]';
        if (Array.isArray(value)) return value.map(item => sanitize(item));
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
        }
        return value;
    };
    return sanitize(body);
}

// Export flush function for graceful shutdown
export const flushAnalytics = flushAnalyticsBuffer;
