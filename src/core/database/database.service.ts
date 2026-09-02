import { Injectable, OnApplicationShutdown, Logger, Inject } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { ConfigService } from '../config/config.service';

export interface TransactionalContext {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;
  private readonly logger = new Logger('DatabaseService');

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.databaseUrl,
      max: this.configService.databaseMaxConnections,
      idleTimeoutMillis: this.configService.databaseIdleTimeoutMs,
      connectionTimeoutMillis: this.configService.databaseConnectionTimeoutMs,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client', err.stack);
    });
  }

  /**
   * Executes a standalone query outside of an explicit transaction.
   */
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, params);
  }

  /**
   * Safe transaction abstraction suitable for atomic multi-entity operations.
   * Begins a transaction, executes the callback with the transactional client,
   * commits if successful, and rolls back on any error.
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Performs an active health check query on PostgreSQL.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 as healthy;');
      return res.rows[0]?.healthy === 1;
    } catch (err) {
      this.logger.error(
        'PostgreSQL health check query failed',
        err instanceof Error ? err.stack : err,
      );
      return false;
    }
  }

  /**
   * Gracefully drains the connection pool on application termination.
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Draining PostgreSQL connection pool...');
    await this.pool.end();
    this.logger.log('PostgreSQL connection pool drained.');
  }
}
