import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool?: Pool;
  constructor() {
    if (process.env.DATABASE_URL) this.pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
  }
  private getPool(): Pool {
    if (!this.pool) throw new ServiceUnavailableException('Banco não configurado');
    return this.pool;
  }
  async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
    return (await this.getPool().query(sql, values)).rows as T[];
  }
  async withTenant<T>(organizationId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      // Contexto local à transação, jamais global à conexão reutilizada.
      await client.query('SELECT set_config($1, $2, true)', ['app.organization_id', organizationId]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
  }
  async ready(): Promise<boolean> {
    try { const rows = await this.query<{ok:number}>('SELECT 1 AS ok'); return rows[0]?.ok === 1; }
    catch { return false; }
  }
  async onModuleDestroy() { await this.pool?.end(); }
}
