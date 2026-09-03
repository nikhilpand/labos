import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_METADATA_KEY = 'labos:permissions';

/**
 * Declares one or more granular permission codes required to access a controller or route.
 * Example: @RequirePermissions('customer:create')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
