export interface AuthenticatedPrincipal {
  userId: string;
  laboratoryId: string;
  oidcSubject: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface UserEntity {
  userId: string;
  laboratoryId: string;
  oidcSubjectId: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
