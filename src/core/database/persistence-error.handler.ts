import { ConflictProblem, BadRequestProblem, LabosException } from '../errors/rfc7807.exception';

export interface PersistenceErrorContext {
  entity?: string;
  clientCode?: string;
  [key: string]: unknown;
}

interface PostgresDatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  column?: string;
  table?: string;
}

/**
 * Centralized persistence error handler that translates PostgreSQL SQLSTATE codes
 * into domain RFC 7807 exceptions without scattering database internals across services.
 */
export function handlePersistenceError(error: unknown, context?: PersistenceErrorContext): never {
  if (error instanceof LabosException) {
    throw error;
  }

  const pgError = error as PostgresDatabaseError;

  if (pgError && typeof pgError.code === 'string') {
    switch (pgError.code) {
      // 23505: unique_violation
      case '23505': {
        const clientCode = context?.clientCode ? ` '${context.clientCode}'` : '';
        const detail =
          pgError.constraint === 'uq_customers_lab_client_code' ||
          (pgError.detail && pgError.detail.includes('client_code'))
            ? `Customer with client code${clientCode} already exists in this laboratory.`
            : `A resource with conflicting unique attributes already exists: ${pgError.detail ?? pgError.message}`;

        throw new ConflictProblem(detail);
      }

      // 23503: foreign_key_violation
      case '23503': {
        throw new BadRequestProblem(
          `Referenced entity constraint failed: ${pgError.detail ?? pgError.message}`,
        );
      }

      // 23502: not_null_violation
      case '23502': {
        throw new BadRequestProblem(
          `Required field '${pgError.column ?? 'unknown'}' cannot be null.`,
        );
      }

      // 23514: check_violation
      case '23514': {
        throw new BadRequestProblem(
          `Database integrity check violated: constraint '${pgError.constraint ?? 'unknown'}'.`,
        );
      }
    }
  }

  // Re-throw unhandled error so transaction managers can handle rollback
  throw error;
}
