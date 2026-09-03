import { z } from 'zod';

export const CreateSampleTypeSchema = z.object({
  code: z
    .string({ required_error: 'Sample type code is required.' })
    .trim()
    .min(1, 'Sample type code cannot be empty.')
    .max(64, 'Sample type code cannot exceed 64 characters.')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Sample type code must contain only alphanumeric characters, underscores, or hyphens.',
    ),
  name: z
    .string({ required_error: 'Sample type name is required.' })
    .trim()
    .min(1, 'Sample type name cannot be empty.')
    .max(255, 'Sample type name cannot exceed 255 characters.'),
  description: z.string().trim().max(1000).optional(),
});

export type CreateSampleTypeDto = z.infer<typeof CreateSampleTypeSchema>;
