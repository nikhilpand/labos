import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from '../../src/platform/auth/guards/permissions.guard';
import { AuthService } from '../../src/platform/auth/auth.service';
import { ForbiddenProblem, UnauthorizedProblem } from '../../src/core/errors/rfc7807.exception';

describe('PermissionsGuard', () => {
  const mockReflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as Reflector;

  const mockAuthService = {
    authenticateHeader: vi.fn(),
  } as unknown as AuthService;

  const createMockContext = (authHeader?: string) => {
    const request: {
      headers: { authorization?: string };
      principal?: any;
    } = {
      headers: {
        authorization: authHeader,
      },
      principal: undefined,
    };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  };

  it('allows access if route has no required permissions declared', async () => {
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue(undefined);
    const guard = new PermissionsGuard(mockReflector, mockAuthService);
    const ctx = createMockContext();

    const allowed = await guard.canActivate(ctx as unknown as ExecutionContext);
    expect(allowed).toBe(true);
  });

  it('throws UnauthorizedProblem when auth header is missing on protected route', async () => {
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue(['customer:create']);
    vi.mocked(mockAuthService.authenticateHeader).mockRejectedValue(
      new UnauthorizedProblem('Missing Authorization header.'),
    );

    const guard = new PermissionsGuard(mockReflector, mockAuthService);
    const ctx = createMockContext(undefined);

    await expect(
      guard.canActivate(ctx as unknown as ExecutionContext),
    ).rejects.toThrow(UnauthorizedProblem);
  });

  it('throws ForbiddenProblem when principal lacks the required permission', async () => {
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue(['customer:create']);
    vi.mocked(mockAuthService.authenticateHeader).mockResolvedValue({
      userId: 'user-1',
      laboratoryId: 'lab-1',
      oidcSubject: 'sub-1',
      email: 'analyst@test.com',
      fullName: 'Test Analyst',
      roles: ['ANALYST'],
      permissions: ['assay:execute'], // Lacks customer:create!
    });

    const guard = new PermissionsGuard(mockReflector, mockAuthService);
    const ctx = createMockContext('Bearer token-123');

    await expect(
      guard.canActivate(ctx as unknown as ExecutionContext),
    ).rejects.toThrow(ForbiddenProblem);
  });

  it('allows access when principal possesses the required permission', async () => {
    vi.mocked(mockReflector.getAllAndOverride).mockReturnValue(['customer:create']);
    vi.mocked(mockAuthService.authenticateHeader).mockResolvedValue({
      userId: 'user-2',
      laboratoryId: 'lab-1',
      oidcSubject: 'sub-2',
      email: 'accessioner@test.com',
      fullName: 'Test Accessioner',
      roles: ['ACCESSIONER'],
      permissions: ['customer:create', 'sample:accession'],
    });

    const guard = new PermissionsGuard(mockReflector, mockAuthService);
    const ctx = createMockContext('Bearer token-accessioner');

    const allowed = await guard.canActivate(ctx as unknown as ExecutionContext);
    expect(allowed).toBe(true);
    expect(ctx.request.principal).toBeDefined();
    expect(ctx.request.principal?.email).toBe('accessioner@test.com');
  });
});
