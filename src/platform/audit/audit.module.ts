import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditVerifierService } from './audit-verifier.service';

@Module({
  providers: [AuditService, AuditVerifierService],
  exports: [AuditService, AuditVerifierService],
})
export class AuditModule {}
