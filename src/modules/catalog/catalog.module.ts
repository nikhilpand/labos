import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { LaboratoryModule } from '../../platform/laboratory/laboratory.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, LaboratoryModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRepository],
  exports: [CatalogService, CatalogRepository],
})
export class CatalogModule {}
