interface AnalyticsEvent {
    event: string;
    page: string;
    role?: string;
    timestamp: Date;
    userAgent: string;
    username?: string;
    ip?: string;
    sessionId: string;
    device?: string;
    data?: Record<string, any>;
}

interface AnalyticsStats {
    totalEvents: number;
    pageViews: number;
    actions: number;
    roleUsage: Record<string, number>;
    mostVisitedPages: Array<{ page: string; count: number }>;
    recentEvents: AnalyticsEvent[];
    userSessions: Array<{ username: string; sessionId: string; eventCount: number; lastSeen: Date }>;
}

// Generate unique session ID
const generateSessionId = (): string => {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
};

// Detect device type from user agent
const getDeviceType = (ua: string): string => {
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet|ipad/i.test(ua)) return 'Tablet';
    return 'Desktop';
};

class AnalyticsService {
    private events: AnalyticsEvent[] = [];
    private readonly MAX_EVENTS = 1000;
    private readonly STORAGE_KEY = 'trazabilidad_analytics';
    private sessionId: string;
    private cachedIP: string | null = null;

    constructor() {
        this.sessionId = sessionStorage.getItem('analytics_session') || generateSessionId();
        sessionStorage.setItem('analytics_session', this.sessionId);
        this.loadFromStorage();
        this.fetchIP();
    }

    private async fetchIP(): Promise<void> {
        try {
            // Use public IP API (free, no key required)
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            this.cachedIP = data.ip;
        } catch (error) {
            this.cachedIP = 'local';
        }
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this.events = data.map((e: any) => ({
                    ...e,
                    timestamp: new Date(e.timestamp)
                }));
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events.slice(0, this.MAX_EVENTS)));
        } catch (error) {
            console.error('Error saving analytics:', error);
        }
    }

    private getCurrentUsername(): string {
        try {
            const user = localStorage.getItem('user');
            if (user) {
                const parsed = JSON.parse(user);
                return parsed.email || parsed.nombre || 'unknown';
            }
        } catch { }
        return 'anonymous';
    }

    trackPageView(page: string, role?: string): void {
        this.addEvent({
            event: 'pageview',
            page,
            role,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            username: this.getCurrentUsername(),
            ip: this.cachedIP || 'fetching...',
            sessionId: this.sessionId,
            device: getDeviceType(navigator.userAgent)
        });
    }

    trackAction(action: string, page: string, role?: string, data?: Record<string, any>): void {
        this.addEvent({
            event: action,
            page,
            role,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            username: this.getCurrentUsername(),
            ip: this.cachedIP || 'fetching...',
            sessionId: this.sessionId,
            device: getDeviceType(navigator.userAgent),
            data
        });
    }

    trackRoleSelection(role: string): void {
        this.trackAction('role_selected', 'role_selection', role, { role });
    }

    trackNavigation(to: string, from: string, role?: string): void {
        this.trackAction('navigation', to, role, { from, to });
    }

    trackLogin(email: string, success: boolean): void {
        this.trackAction('login', 'login', undefined, { email, success });
    }

    trackButtonClick(buttonName: string, page: string, role?: string): void {
        this.trackAction('click', page, role, { button: buttonName });
    }

    private addEvent(event: AnalyticsEvent): void {
        this.events.unshift(event);
        if (this.events.length > this.MAX_EVENTS) {
            this.events = this.events.slice(0, this.MAX_EVENTS);
        }
        this.saveToStorage();
    }

    getStats(): AnalyticsStats {
        const pageViews = this.events.filter(e => e.event === 'pageview');
        const actions = this.events.filter(e => e.event !== 'pageview');

        const roleUsage: Record<string, number> = {};
        this.events.forEach(e => {
            if (e.role) {
                roleUsage[e.role] = (roleUsage[e.role] || 0) + 1;
            }
        });

        const pageCount: Record<string, number> = {};
        pageViews.forEach(e => {
            pageCount[e.page] = (pageCount[e.page] || 0) + 1;
        });

        const mostVisitedPages = Object.entries(pageCount)
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // User sessions aggregation
        const sessionMap: Record<string, { username: string; eventCount: number; lastSeen: Date }> = {};
        this.events.forEach(e => {
            if (!sessionMap[e.sessionId]) {
                sessionMap[e.sessionId] = {
                    username: e.username || 'anonymous',
                    eventCount: 0,
                    lastSeen: e.timestamp
                };
            }
            sessionMap[e.sessionId].eventCount++;
            if (e.timestamp > sessionMap[e.sessionId].lastSeen) {
                sessionMap[e.sessionId].lastSeen = e.timestamp;
            }
        });

        const userSessions = Object.entries(sessionMap)
            .map(([sessionId, data]) => ({ sessionId, ...data }))
            .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
            .slice(0, 20);

        return {
            totalEvents: this.events.length,
            pageViews: pageViews.length,
            actions: actions.length,
            roleUsage,
            mostVisitedPages,
            recentEvents: this.events.slice(0, 50),
            userSessions
        };
    }

    exportData(): string {
        return JSON.stringify(this.events, null, 2);
    }

    clearData(): void {
        this.events = [];
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

export const analyticsService = new AnalyticsService();
export type { AnalyticsEvent, AnalyticsStats };
