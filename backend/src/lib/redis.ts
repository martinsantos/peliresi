import { createClient, RedisClientType } from 'redis';

// TTL en segundos para diferentes tipos de caché
export const CACHE_TTL = {
  USER: 300,           // 5 min - datos de usuario autenticado
  CATALOGO: 3600,      // 1 hora - tipos de residuos, operadores
  STATS: 60,           // 1 min - estadísticas del dashboard
  MANIFIESTO: 30,      // 30 seg - detalle de manifiesto
  SESSION: 86400       // 24 horas - sesiones
};

// Prefijos para organizar keys
export const CACHE_PREFIX = {
  USER: 'user:',
  CATALOGO: 'catalogo:',
  STATS: 'stats:',
  MANIFIESTO: 'manifiesto:'
};

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[Redis] Max retries reached, giving up');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('[Redis] Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      await this.client.connect();
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      // No lanzar error - la app debe funcionar sin Redis (degraded mode)
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Redis] Get error for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = CACHE_TTL.USER): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Redis] Set error for ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Del error for ${key}:`, error);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`[Redis] DelPattern error for ${pattern}:`, error);
      return false;
    }
  }

  // Invalidar caché de usuario específico
  async invalidateUser(userId: string): Promise<void> {
    await this.del(`${CACHE_PREFIX.USER}${userId}`);
  }

  // Invalidar caché de estadísticas (todos los roles)
  async invalidateStats(): Promise<void> {
    await this.delPattern(`${CACHE_PREFIX.STATS}*`);
  }

  // Invalidar caché de manifiesto específico
  async invalidateManifiesto(manifiestoId: string): Promise<void> {
    await this.del(`${CACHE_PREFIX.MANIFIESTO}${manifiestoId}`);
    // También invalidar stats porque cambiaron los conteos
    await this.invalidateStats();
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton
export const redisService = new RedisService();
