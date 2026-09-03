import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import { Laboratory, Organization } from './laboratory.types';

@Injectable()
export class LaboratoryRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findLaboratoryById(
    laboratoryId: string,
    context?: TransactionalContext,
  ): Promise<Laboratory | null> {
    const executor = context ?? this.db;
    const result = await executor.query<{
      laboratory_id: string;
      organization_id: string;
      name: string;
      accreditation_number: string;
      accreditation_body: string;
      status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT laboratory_id, organization_id, name, accreditation_number, accreditation_body, status, created_at, updated_at
       FROM laboratories
       WHERE laboratory_id = $1;`,
      [laboratoryId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      laboratoryId: row.laboratory_id,
      organizationId: row.organization_id,
      name: row.name,
      accreditationNumber: row.accreditation_number,
      accreditationBody: row.accreditation_body,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findOrganizationById(
    organizationId: string,
    context?: TransactionalContext,
  ): Promise<Organization | null> {
    const executor = context ?? this.db;
    const result = await executor.query<{
      organization_id: string;
      legal_name: string;
      tax_identifier: string | null;
      country_of_incorporation: string;
      status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT organization_id, legal_name, tax_identifier, country_of_incorporation, status, created_at, updated_at
       FROM organizations
       WHERE organization_id = $1;`,
      [organizationId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      organizationId: row.organization_id,
      legalName: row.legal_name,
      taxIdentifier: row.tax_identifier,
      countryOfIncorporation: row.country_of_incorporation,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
