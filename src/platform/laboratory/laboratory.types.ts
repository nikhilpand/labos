export interface Organization {
  organizationId: string;
  legalName: string;
  taxIdentifier: string | null;
  countryOfIncorporation: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Laboratory {
  laboratoryId: string;
  organizationId: string;
  name: string;
  accreditationNumber: string;
  accreditationBody: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}
