import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { TestRequestRepository } from './test-request.repository';
import { TestRequestService } from './test-request.service';
import { TestRequestController } from './test-request.controller';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [TestRequestController],
  providers: [TestRequestRepository, TestRequestService],
  exports: [TestRequestRepository, TestRequestService],
})
export class TestRequestModule {}
