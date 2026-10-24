import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Best-effort Redis cache for expensive, read-heavy aggregations (dashboards,
 * reports). Never throws: if Redis is unreachable, callers just fall back to
 * computing the result directly from Postgres.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on('error', (err) =>
      this.logger.warn(`Redis cache unavailable: ${err.message}`),
    );
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // best-effort cache write; ignore failures
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.client.del(...keys);
    } catch {
      // best-effort cache invalidation; ignore failures
    }
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
