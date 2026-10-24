import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { withTenantScoping } from './tenant-scoping.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined');
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;

    // Every consumer of PrismaService must get tenant-scoped queries (see
    // tenant-scoping.extension.ts), so rather than expose a second
    // injectable, swap `this` for the extended client — $extends() returns a
    // client with the identical model-delegate shape, it just adds scoping
    // behavior. The extended object doesn't inherit our custom lifecycle
    // methods, so they're copied onto it before it becomes the real instance.
    const extended = withTenantScoping(this) as unknown as PrismaService;
    extended.onModuleInit = this.onModuleInit.bind(this);
    extended.onModuleDestroy = this.onModuleDestroy.bind(this);
    return extended;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
