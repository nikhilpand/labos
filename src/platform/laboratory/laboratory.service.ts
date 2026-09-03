import { Injectable, Inject } from '@nestjs/common';
import { LaboratoryRepository } from './laboratory.repository';
import { Laboratory } from './laboratory.types';
import { NotFoundProblem, ConflictProblem } from '../../core/errors/rfc7807.exception';
import { TransactionalContext } from '../../core/database/database.service';

@Injectable()
export class LaboratoryService {
  constructor(
    @Inject(LaboratoryRepository)
    private readonly repo: LaboratoryRepository,
  ) {}

  async getLaboratory(laboratoryId: string, context?: TransactionalContext): Promise<Laboratory> {
    const lab = await this.repo.findLaboratoryById(laboratoryId, context);
    if (!lab) {
      throw new NotFoundProblem('Laboratory', laboratoryId);
    }
    return lab;
  }

  async ensureActiveLaboratory(
    laboratoryId: string,
    context?: TransactionalContext,
  ): Promise<Laboratory> {
    const lab = await this.getLaboratory(laboratoryId, context);
    if (lab.status !== 'ACTIVE') {
      throw new ConflictProblem(
        `Laboratory '${lab.name}' (${laboratoryId}) is currently ${lab.status} and cannot process new registrations.`,
      );
    }
    return lab;
  }
}
