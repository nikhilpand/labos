import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { generateUuidV7 } from '../common/uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingHeader = req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof existingHeader === 'string' && existingHeader.trim().length > 0
        ? existingHeader
        : generateUuidV7();

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
