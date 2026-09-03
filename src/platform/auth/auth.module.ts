import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [Reflector, AuthService, PermissionsGuard],
  exports: [Reflector, AuthService, PermissionsGuard],
})
export class AuthModule {}
