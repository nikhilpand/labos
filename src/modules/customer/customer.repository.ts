import { Injectable } from '@nestjs/common';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import { CustomerEntity, ContactEntity } from './customer.types';

interface CustomerRow {
  customer_id: string;
  laboratory_id: string;
  client_code: string;
  company_name: string;
  billing_street: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  status: 'ACTIVE' | 'HOLD' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

interface ContactRow {
  contact_id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role_title: string | null;
  is_primary_contact: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CustomerRepository {
  private mapCustomerRow(row: CustomerRow): CustomerEntity {
    return {
      customerId: row.customer_id,
      laboratoryId: row.laboratory_id,
      clientCode: row.client_code,
      companyName: row.company_name,
      billingAddress: {
        street: row.billing_street ?? undefined,
        city: row.billing_city ?? undefined,
        state: row.billing_state ?? undefined,
        postalCode: row.billing_postal_code ?? undefined,
        country: row.billing_country ?? undefined,
      },
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapContactRow(row: ContactRow): ContactEntity {
    return {
      contactId: row.contact_id,
      customerId: row.customer_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      roleTitle: row.role_title,
      isPrimaryContact: row.is_primary_contact,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async insertCustomer(
    tx: TransactionalContext,
    customer: Omit<CustomerEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<CustomerEntity> {
    const result = await tx.query<CustomerRow>(
      `INSERT INTO customers (
        customer_id,
        laboratory_id,
        client_code,
        company_name,
        billing_street,
        billing_city,
        billing_state,
        billing_postal_code,
        billing_country,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;`,
      [
        customer.customerId,
        customer.laboratoryId,
        customer.clientCode,
        customer.companyName,
        customer.billingAddress?.street ?? null,
        customer.billingAddress?.city ?? null,
        customer.billingAddress?.state ?? null,
        customer.billingAddress?.postalCode ?? null,
        customer.billingAddress?.country ?? null,
        customer.status,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Customer insertion failed to return inserted record.');
    }
    return this.mapCustomerRow(row);
  }

  async insertContact(
    tx: TransactionalContext,
    contact: Omit<ContactEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<ContactEntity> {
    const result = await tx.query<ContactRow>(
      `INSERT INTO contacts (
        contact_id,
        customer_id,
        first_name,
        last_name,
        email,
        phone,
        role_title,
        is_primary_contact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;`,
      [
        contact.contactId,
        contact.customerId,
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone ?? null,
        contact.roleTitle ?? null,
        contact.isPrimaryContact,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Contact insertion failed to return inserted record.');
    }
    return this.mapContactRow(row);
  }

  async findCustomerByClientCode(
    txOrDb: TransactionalContext | DatabaseService,
    laboratoryId: string,
    clientCode: string,
  ): Promise<CustomerEntity | null> {
    const result = await txOrDb.query<CustomerRow>(
      `SELECT * FROM customers
       WHERE laboratory_id = $1 AND client_code = $2;`,
      [laboratoryId, clientCode],
    );

    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapCustomerRow(result.rows[0]);
  }

  async findCustomerById(
    txOrDb: TransactionalContext | DatabaseService,
    customerId: string,
  ): Promise<CustomerEntity | null> {
    const result = await txOrDb.query<CustomerRow>(
      `SELECT * FROM customers WHERE customer_id = $1;`,
      [customerId],
    );

    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapCustomerRow(result.rows[0]);
  }

  async findPrimaryContact(
    txOrDb: TransactionalContext | DatabaseService,
    customerId: string,
  ): Promise<ContactEntity | null> {
    const result = await txOrDb.query<ContactRow>(
      `SELECT * FROM contacts
       WHERE customer_id = $1 AND is_primary_contact = TRUE;`,
      [customerId],
    );

    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapContactRow(result.rows[0]);
  }
}
