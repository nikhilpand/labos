import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AuditService } from '../../platform/audit/audit.service';
import { CustomerRepository } from './customer.repository';
import { AuthenticatedPrincipal } from '../../platform/auth/auth.types';
import { RegisterCustomerInput, CustomerRegistrationResult } from './customer.types';
import { generateUuidV7 } from '../../core/common/uuid';
import { ConflictProblem, BadRequestProblem } from '../../core/errors/rfc7807.exception';
import { handlePersistenceError } from '../../core/database/persistence-error.handler';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger('CustomerService');

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(CustomerRepository) private readonly customerRepo: CustomerRepository,
  ) {}

  /**
   * Registers a new commercial Customer account along with its mandatory Primary Contact
   * within the caller's active Laboratory context in a single ACID database transaction.
   */
  async registerCustomer(
    input: RegisterCustomerInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<CustomerRegistrationResult> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();

    // 1. Enforce domain invariants
    if (!input.primaryContact || !input.primaryContact.email) {
      throw new BadRequestProblem(
        'A valid primary contact with an email is mandatory for customer registration.',
      );
    }

    const trimmedClientCode = input.clientCode.trim();
    if (!trimmedClientCode) {
      throw new BadRequestProblem('Client code cannot be empty.');
    }

    // 2. Application-level pre-check for user-friendly duplicate conflict detection
    const existing = await this.customerRepo.findCustomerByClientCode(
      this.db,
      laboratoryId,
      trimmedClientCode,
    );
    if (existing) {
      throw new ConflictProblem(
        `Customer with client code '${trimmedClientCode}' already exists in this laboratory.`,
      );
    }

    const customerId = generateUuidV7();
    const contactId = generateUuidV7();

    try {
      // 3. Single ACID Transaction: Customer + Primary Contact + Audit Event
      const result = await this.db.transaction(async (tx) => {
        // Step A: Insert Customer
        const customer = await this.customerRepo.insertCustomer(tx, {
          customerId,
          laboratoryId,
          clientCode: trimmedClientCode,
          companyName: input.companyName.trim(),
          billingAddress: input.billingAddress ?? {},
          status: 'ACTIVE',
        });

        // Step B: Insert Primary Contact (is_primary_contact = true)
        const contact = await this.customerRepo.insertContact(tx, {
          contactId,
          customerId,
          firstName: input.primaryContact.firstName.trim(),
          lastName: input.primaryContact.lastName.trim(),
          email: input.primaryContact.email.trim().toLowerCase(),
          phone: input.primaryContact.phone?.trim() ?? null,
          roleTitle: input.primaryContact.roleTitle?.trim() ?? null,
          isPrimaryContact: true,
        });

        // Step C: Append Audit Event in the exact same transaction
        const auditEvent = await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'CUSTOMER_REGISTERED',
            entityType: 'Customer',
            entityId: customerId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              clientCode: customer.clientCode,
              companyName: customer.companyName,
              status: customer.status,
              primaryContactEmail: contact.email,
            },
          },
          tx,
        );

        return {
          customer,
          contact,
          auditEventId: auditEvent.auditEventId,
        };
      });

      this.logger.log(
        `[Customer Registration] Registered customer '${trimmedClientCode}' (${customerId}) in laboratory ${laboratoryId} by actor ${actorUserId}`,
      );

      return {
        customerId: result.customer.customerId,
        laboratoryId: result.customer.laboratoryId,
        clientCode: result.customer.clientCode,
        companyName: result.customer.companyName,
        status: result.customer.status,
        createdAt: result.customer.createdAt.toISOString(),
        primaryContact: {
          contactId: result.contact.contactId,
          firstName: result.contact.firstName,
          lastName: result.contact.lastName,
          email: result.contact.email,
          phone: result.contact.phone,
          isPrimaryContact: result.contact.isPrimaryContact,
        },
        auditEventId: result.auditEventId,
      };
    } catch (error) {
      handlePersistenceError(error, {
        clientCode: trimmedClientCode,
        entity: 'Customer',
      });
    }
  }

  /**
   * Retrieves a customer by ID within the active laboratory context.
   */
  async getCustomerById(
    customerId: string,
    laboratoryId: string,
  ): Promise<CustomerRegistrationResult | null> {
    const customer = await this.customerRepo.findCustomerById(this.db, customerId);
    if (!customer || customer.laboratoryId !== laboratoryId) {
      return null;
    }

    const primaryContact = await this.customerRepo.findPrimaryContact(this.db, customerId);

    return {
      customerId: customer.customerId,
      laboratoryId: customer.laboratoryId,
      clientCode: customer.clientCode,
      companyName: customer.companyName,
      status: customer.status,
      createdAt: customer.createdAt.toISOString(),
      primaryContact: {
        contactId: primaryContact?.contactId ?? '',
        firstName: primaryContact?.firstName ?? '',
        lastName: primaryContact?.lastName ?? '',
        email: primaryContact?.email ?? '',
        phone: primaryContact?.phone ?? null,
        isPrimaryContact: primaryContact?.isPrimaryContact ?? true,
      },
      auditEventId: '',
    };
  }
}
