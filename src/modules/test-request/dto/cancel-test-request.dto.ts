import { z } from 'zod';

export const CancelTestRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, { message: 'A documented cancellation reason is required' })
      .max(1000, { message: 'Cancellation reason cannot exceed 1000 characters' }),
  })
  .strict();

export type CancelTestRequestDto = z.infer<typeof CancelTestRequestSchema>;
