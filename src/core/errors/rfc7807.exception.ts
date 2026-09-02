import { HttpException, HttpStatus } from '@nestjs/common';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  correlationId?: string;
  timestamp: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export class LabosException extends HttpException {
  public readonly code: string;
  public readonly detail: string;
  public readonly typeUrl: string;
  public readonly invalidParams?: Array<{ name: string; reason: string }>;

  constructor(options: {
    status: HttpStatus;
    title: string;
    detail: string;
    code: string;
    typeUrl?: string;
    invalidParams?: Array<{ name: string; reason: string }>;
  }) {
    super(options.title, options.status);
    this.code = options.code;
    this.detail = options.detail;
    this.typeUrl = options.typeUrl ?? `https://labos.dev/errors/${options.code.toLowerCase()}`;
    this.invalidParams = options.invalidParams;
  }
}

export class BadRequestProblem extends LabosException {
  constructor(detail: string, invalidParams?: Array<{ name: string; reason: string }>) {
    super({
      status: HttpStatus.BAD_REQUEST,
      title: 'Bad Request',
      detail,
      code: 'BAD_REQUEST',
      invalidParams,
    });
  }
}

export class UnauthorizedProblem extends LabosException {
  constructor(detail = 'Authentication credentials were missing or invalid.') {
    super({
      status: HttpStatus.UNAUTHORIZED,
      title: 'Unauthorized',
      detail,
      code: 'UNAUTHORIZED',
    });
  }
}

export class ForbiddenProblem extends LabosException {
  constructor(
    detail = 'You do not possess the required laboratory permissions to perform this action.',
  ) {
    super({
      status: HttpStatus.FORBIDDEN,
      title: 'Forbidden',
      detail,
      code: 'FORBIDDEN',
    });
  }
}

export class NotFoundProblem extends LabosException {
  constructor(entityName: string, id: string) {
    super({
      status: HttpStatus.NOT_FOUND,
      title: 'Resource Not Found',
      detail: `${entityName} with identifier '${id}' was not found.`,
      code: 'RESOURCE_NOT_FOUND',
    });
  }
}

export class ConflictProblem extends LabosException {
  constructor(detail: string) {
    super({
      status: HttpStatus.CONFLICT,
      title: 'Conflict',
      detail,
      code: 'CONFLICT',
    });
  }
}
