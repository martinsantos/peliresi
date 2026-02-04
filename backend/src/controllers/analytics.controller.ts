// Analytics Controller - Superadmin only stats and logs
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Get super admin email from env
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'santosma@gmail.com';

// Middleware to check superadmin access
export const isSuperAdmin = (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;

    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
            success: false,
            error: 'Acceso restringido a superadmin'
        });
    }

    next();
};

// Get analytics summary
export const getAnalyticsSummary = async (req: Request, res: Response) => {
    try {
        const { desde, hasta } = req.query;

        const startDate = desde ? new Date(desde as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        const endDate = hasta ? new Date(hasta as string) : new Date();

        // Total requests
        const totalRequests = await prisma.analyticsLog.count({
            where: {
                timestamp: { gte: startDate, lte: endDate }
            }
        });

        // Unique users
        const uniqueUsers = await prisma.analyticsLog.groupBy({
            by: ['userId'],
            where: {
                timestamp: { gte: startDate, lte: endDate },
                userId: { not: null }
            }
        });

        // Requests by endpoint
        const byEndpoint = await prisma.analyticsLog.groupBy({
            by: ['path', 'method'],
            where: {
                timestamp: { gte: startDate, lte: endDate }
            },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 20
        });

        // Requests by user
        const byUser = await prisma.analyticsLog.groupBy({
            by: ['userEmail'],
            where: {
                timestamp: { gte: startDate, lte: endDate },
                userEmail: { not: null }
            },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 20
        });

        // Average response time
        const avgResponseTime = await prisma.analyticsLog.aggregate({
            where: {
                timestamp: { gte: startDate, lte: endDate }
            },
            _avg: { responseTimeMs: true }
        });

        // Errors (status >= 400)
        const errors = await prisma.analyticsLog.count({
            where: {
                timestamp: { gte: startDate, lte: endDate },
                statusCode: { gte: 400 }
            }
        });

        // Requests per day
        const requestsPerDay = await prisma.$queryRaw`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM "AnalyticsLog"
      WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `;

        res.json({
            success: true,
            data: {
                periodo: { desde: startDate, hasta: endDate },
                resumen: {
                    totalRequests,
                    uniqueUsers: uniqueUsers.length,
                    avgResponseTimeMs: Math.round(avgResponseTime._avg.responseTimeMs || 0),
                    errorRate: totalRequests > 0 ? ((errors / totalRequests) * 100).toFixed(2) + '%' : '0%'
                },
                porEndpoint: byEndpoint.map(e => ({
                    endpoint: `${e.method} ${e.path}`,
                    count: e._count.id
                })),
                porUsuario: byUser.map(u => ({
                    email: u.userEmail,
                    count: u._count.id
                })),
                requestsPorDia: requestsPerDay
            }
        });
    } catch (error) {
        console.error('Error getting analytics summary:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
};

// Get detailed logs
export const getAnalyticsLogs = async (req: Request, res: Response) => {
    try {
        const {
            page = '1',
            limit = '50',
            userId,
            path,
            method,
            statusCode,
            desde,
            hasta
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = Math.min(parseInt(limit as string), 100);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        if (userId) where.userId = userId;
        if (path) where.path = { contains: path as string };
        if (method) where.method = method;
        if (statusCode) where.statusCode = parseInt(statusCode as string);
        if (desde || hasta) {
            where.timestamp = {};
            if (desde) where.timestamp.gte = new Date(desde as string);
            if (hasta) where.timestamp.lte = new Date(hasta as string);
        }

        const [logs, total] = await Promise.all([
            prisma.analyticsLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limitNum
            }),
            prisma.analyticsLog.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (error) {
        console.error('Error getting analytics logs:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener logs'
        });
    }
};

// Get user activity
export const getUserActivity = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;
        const { limite = '100' } = req.query;

        const activities = await prisma.analyticsLog.findMany({
            where: { userEmail: email },
            orderBy: { timestamp: 'desc' },
            take: parseInt(limite as string)
        });

        // Group by action type
        const summary = await prisma.analyticsLog.groupBy({
            by: ['path', 'method'],
            where: { userEmail: email },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });

        res.json({
            success: true,
            data: {
                email,
                totalActions: activities.length,
                recentActivity: activities.slice(0, 20),
                actionSummary: summary.map(s => ({
                    action: `${s.method} ${s.path}`,
                    count: s._count.id
                }))
            }
        });
    } catch (error) {
        console.error('Error getting user activity:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener actividad del usuario'
        });
    }
};
