import { z } from 'zod';

export const CreateTestRequestSchema = z
  .object({
    customerId: z.string().uuid({ message: 'customerId must be a valid UUID' }),
    customerReference: z
      .string()
      .trim()
      .max(100, { message: 'customerReference cannot exceed 100 characters' })
      .optional(),
    specialInstructions: z
      .string()
      .trim()
      .max(2000, { message: 'specialInstructions cannot exceed 2000 characters' })
      .optional(),
    methodVersionIds: z
      .array(z.string().uuid({ message: 'Each methodVersionId must be a valid UUID' }))
      .min(1, { message: 'At least one methodVersionId must be specified' })
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Duplicate methodVersionIds are not permitted within a single test request',
      }),
  })
  .strict();

export type CreateTestRequestDto = z.infer<typeof CreateTestRequestSchema>;
