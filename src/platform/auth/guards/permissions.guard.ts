import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { PERMISSIONS_METADATA_KEY } from '../decorators/require-permissions.decorator';
import { ForbiddenProblem } from '../../../core/errors/rfc7807.exception';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // If route doesn't specify required permissions, but has auth header, resolve principal if possible
    if (!requiredPermissions || requiredPermissions.length === 0) {
      if (authHeader) {
        try {
          request.principal = await this.authService.authenticateHeader(authHeader);
        } catch {
          // Permissive if route has no permissions required
        }
      }
      return true;
    }

    // Authenticate principal
    const principal = await this.authService.authenticateHeader(authHeader);
    request.principal = principal;

    // Check granular permissions
    const userPermissions = new Set(principal.permissions);
    const missingPermissions = requiredPermissions.filter(
      (perm) => !userPermissions.has(perm),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenProblem(
        `Access denied. You lack the required domain permission(s): [${missingPermissions.join(', ')}].`,
      );
    }

    return true;
  }
}
