// Analytics Middleware - Tracks all API requests for superadmin stats
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        console.error('Error flushing analytics:', error);
        // Re-add failed entries (up to buffer size)
        analyticsBuffer.push(...dataToInsert.slice(0, BUFFER_SIZE));
    }
}

// Start periodic flush
setInterval(flushAnalyticsBuffer, FLUSH_INTERVAL);

// Middleware
export const analyticsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        // Get user info from request (set by auth middleware)
        const user = (req as any).user;

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
            body: ['POST', 'PUT', 'PATCH'].includes(req.method) && !req.path.includes('login')
                ? JSON.stringify(sanitizeBody(req.body)).substring(0, 500)
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
function sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'token', 'secret', 'credential'];

    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            sanitized[key] = '[REDACTED]';
        }
    }

    return sanitized;
}

// Export flush function for graceful shutdown
export const flushAnalytics = flushAnalyticsBuffer;
