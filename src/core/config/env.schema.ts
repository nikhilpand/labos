import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z
      .string()
      .default('3000')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().positive().max(65535)),
    DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection URL' }),
    DATABASE_MAX_CONNECTIONS: z
      .string()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().positive()),
    DATABASE_IDLE_TIMEOUT_MS: z
      .string()
      .default('10000')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().positive()),
    DATABASE_CONNECTION_TIMEOUT_MS: z
      .string()
      .default('5000')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().positive()),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    OIDC_ISSUER_URL: z.string().url().default('http://localhost:8080/realms/labos'),
    OIDC_AUDIENCE: z.string().min(1).default('labos-api'),
    BYPASS_FOUR_EYES_FOR_DEV: z
      .string()
      .default('false')
      .transform((val) => val === 'true'),
  })
  .refine(
    (data) => {
      // Security Invariant: BYPASS_FOUR_EYES_FOR_DEV must NEVER be true in production!
      if (data.NODE_ENV === 'production' && data.BYPASS_FOUR_EYES_FOR_DEV) {
        return false;
      }
      return true;
    },
    {
      message: 'BYPASS_FOUR_EYES_FOR_DEV cannot be enabled in production environment!',
      path: ['BYPASS_FOUR_EYES_FOR_DEV'],
    },
  );

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates the raw environment dictionary and returns the typed configuration.
 * Throws a descriptive error on failure, causing the application to fail fast.
 */
export function validateEnv(rawEnv: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(`[LabOS Startup Error] Environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}
