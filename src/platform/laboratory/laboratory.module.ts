import { Module } from '@nestjs/common';
import { LaboratoryRepository } from './laboratory.repository';
import { LaboratoryService } from './laboratory.service';

@Module({
  providers: [LaboratoryRepository, LaboratoryService],
  exports: [LaboratoryRepository, LaboratoryService],
})
export class LaboratoryModule {}
