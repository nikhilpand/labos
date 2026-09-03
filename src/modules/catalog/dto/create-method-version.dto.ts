import { z } from 'zod';

export const CreateMethodVersionSchema = z.object({
  revisionLabel: z
    .string({ required_error: 'Revision label is required.' })
    .trim()
    .min(1, 'Revision label cannot be empty.')
    .max(32, 'Revision label cannot exceed 32 characters.'),
  accreditationStatus: z.enum(['ACCREDITED', 'NON_ACCREDITED']).default('ACCREDITED'),
  sopReference: z.string().trim().max(255).optional(),
  sampleTypeIds: z.array(z.string().uuid('Sample type ID must be a valid UUID.')).optional(),
});

export type CreateMethodVersionDto = z.infer<typeof CreateMethodVersionSchema>;
