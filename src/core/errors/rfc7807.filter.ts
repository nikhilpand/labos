import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LabosException, ProblemDetails } from './rfc7807.exception';
import { ConfigService } from '../config/config.service';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = (request.headers['x-correlation-id'] as string) || 'unknown';
    const timestamp = new Date().toISOString();
    const instance = request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred while processing the scientific request.';
    let code = 'INTERNAL_SERVER_ERROR';
    let type = 'https://labos.dev/errors/internal-server-error';
    let invalidParams: Array<{ name: string; reason: string }> | undefined = undefined;

    if (exception instanceof LabosException) {
      status = exception.getStatus();
      title = exception.message;
      detail = exception.detail;
      code = exception.code;
      type = exception.typeUrl;
      invalidParams = exception.invalidParams;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = exception.message;
      detail = exception.message;
      code = `HTTP_${status}`;
      type = `https://labos.dev/errors/http-${status}`;
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, unknown>;
        if (typeof respObj.message === 'string') {
          detail = respObj.message;
        } else if (Array.isArray(respObj.message)) {
          detail = 'One or more request parameters failed validation.';
          invalidParams = respObj.message.map((msg) => ({
            name: 'payload',
            reason: String(msg),
          }));
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${correlationId}] Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
      if (!this.configService.isProduction) {
        detail = exception.message;
      }
    }

    const problem: ProblemDetails = {
      type,
      title,
      status,
      detail,
      instance,
      code,
      correlationId,
      timestamp,
      ...(invalidParams && { invalidParams }),
    };

    response.status(status).setHeader('Content-Type', 'application/problem+json').json(problem);
  }
}
