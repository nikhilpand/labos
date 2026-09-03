import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { LaboratoryModule } from '../../platform/laboratory/laboratory.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerRepository } from './customer.repository';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, LaboratoryModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerRepository],
  exports: [CustomerService],
})
export class CustomerModule {}
