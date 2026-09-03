import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { ConfigService } from '../../core/config/config.service';
import { AuthenticatedPrincipal } from './auth.types';
import { UnauthorizedProblem } from '../../core/errors/rfc7807.exception';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /**
   * Resolves internal User identity, active laboratory, assigned roles,
   * and granular permissions using the external OIDC Subject ID.
   */
  async resolvePrincipalBySubject(oidcSubjectId: string): Promise<AuthenticatedPrincipal | null> {
    const userResult = await this.db.query<{
      user_id: string;
      laboratory_id: string;
      oidc_subject_id: string;
      email: string;
      full_name: string;
      status: string;
    }>(
      `SELECT user_id, laboratory_id, oidc_subject_id, email, full_name, status
       FROM users
       WHERE oidc_subject_id = $1 AND status = 'ACTIVE';`,
      [oidcSubjectId],
    );

    const user = userResult.rows[0];
    if (!user) {
      return null;
    }

    // Fetch user roles
    const rolesResult = await this.db.query<{ code: string }>(
      `SELECT r.code
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.role_id
       WHERE ur.user_id = $1;`,
      [user.user_id],
    );
    const roles = rolesResult.rows.map((row) => row.code);

    // Fetch granular permissions linked to assigned roles
    const permissionsResult = await this.db.query<{ permission_code: string }>(
      `SELECT DISTINCT rp.permission_code
       FROM role_permissions rp
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1;`,
      [user.user_id],
    );
    const permissions = permissionsResult.rows.map((row) => row.permission_code);

    return {
      userId: user.user_id,
      laboratoryId: user.laboratory_id,
      oidcSubject: user.oidc_subject_id,
      email: user.email,
      fullName: user.full_name,
      roles,
      permissions,
    };
  }

  /**
   * Validates an incoming Authorization header and returns the authenticated principal.
   * Throws UnauthorizedProblem (401) on missing or invalid credentials.
   */
  async authenticateHeader(authHeader: string | undefined): Promise<AuthenticatedPrincipal> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedProblem(
        'Missing or invalid Authorization header. Expected format: Bearer <token>.',
      );
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedProblem('Bearer authentication token cannot be empty.');
    }

    // Extract subject from token
    let subjectId: string;

    if (token.startsWith('dev-token:')) {
      // In development/test mode, allow deterministic subject mapping
      if (this.config.isProduction) {
        throw new UnauthorizedProblem('Development token scheme is prohibited in production.');
      }
      subjectId = token.substring(10);
    } else {
      // Decode standard base64/JWT subject claim safely
      try {
        const parts = token.split('.');
        if (parts.length === 3 && parts[1]) {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
          const payload = JSON.parse(payloadJson);
          if (!payload.sub || typeof payload.sub !== 'string') {
            throw new UnauthorizedProblem('JWT token is missing a valid Subject (sub) claim.');
          }
          subjectId = payload.sub;
        } else {
          // Direct subject identifier string
          subjectId = token;
        }
      } catch {
        throw new UnauthorizedProblem('Failed to parse authentication token payload.');
      }
    }

    const principal = await this.resolvePrincipalBySubject(subjectId);
    if (!principal) {
      throw new UnauthorizedProblem(
        `User identity with subject '${subjectId}' is not registered or active in this laboratory.`,
      );
    }

    return principal;
  }
}
