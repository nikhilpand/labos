import { Controller, Get, HttpStatus, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { DatabaseService } from '../core/database/database.service';
import { ConfigService } from '../core/config/config.service';

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  checks: {
    database: 'connected' | 'disconnected';
    config: 'loaded';
  };
}

@Controller()
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Get(['health', 'api/v1/health'])
  async getHealth(@Res() res: Response): Promise<void> {
    const isDbConnected = await this.db.checkHealth();
    const isHealthy = isDbConnected;

    const payload: HealthResponse = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: this.config.nodeEnv,
      checks: {
        database: isDbConnected ? 'connected' : 'disconnected',
        config: 'loaded',
      },
    };

    res.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(payload);
  }
}
