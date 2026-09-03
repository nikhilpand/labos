import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPrincipal } from '../auth.types';

/**
 * Extracts the authenticated principal from the active request context.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal => {
    const request = ctx.switchToHttp().getRequest();
    return request.principal as AuthenticatedPrincipal;
  },
);
