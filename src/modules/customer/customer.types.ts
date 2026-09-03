export type CustomerStatus = 'ACTIVE' | 'HOLD' | 'INACTIVE';

export interface BillingAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CustomerEntity {
  customerId: string;
  laboratoryId: string;
  clientCode: string;
  companyName: string;
  billingAddress: BillingAddress;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactEntity {
  contactId: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleTitle: string | null;
  isPrimaryContact: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrimaryContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roleTitle?: string;
}

export interface RegisterCustomerInput {
  clientCode: string;
  companyName: string;
  billingAddress?: BillingAddress;
  primaryContact: PrimaryContactInput;
}

export interface CustomerRegistrationResult {
  customerId: string;
  laboratoryId: string;
  clientCode: string;
  companyName: string;
  status: CustomerStatus;
  createdAt: string;
  primaryContact: {
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isPrimaryContact: boolean;
  };
  auditEventId: string;
}
