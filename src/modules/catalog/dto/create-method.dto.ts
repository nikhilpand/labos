import { z } from 'zod';
import { MethodParameterItemSchema } from './configure-method-parameters.dto';

export const MethodCodeRegex = /^[A-Za-z0-9_.-]+$/;

export const CreateMethodSchema = z.object({
  code: z
    .string({ required_error: 'Method code is required.' })
    .trim()
    .min(1, 'Method code cannot be empty.')
    .max(64, 'Method code cannot exceed 64 characters.')
    .regex(
      MethodCodeRegex,
      'Method code must contain only alphanumeric characters, underscores, hyphens, or periods.',
    ),
  name: z
    .string({ required_error: 'Method name is required.' })
    .trim()
    .min(2, 'Method name must be at least 2 characters long.')
    .max(255, 'Method name cannot exceed 255 characters.'),
  regulatoryAgency: z.string().trim().max(64).optional(),
  description: z.string().trim().max(2000).optional(),
  revisionLabel: z
    .string()
    .trim()
    .min(1, 'Revision label cannot be empty.')
    .max(32, 'Revision label cannot exceed 32 characters.')
    .default('Rev 1.0'),
  accreditationStatus: z.enum(['ACCREDITED', 'NON_ACCREDITED']).default('ACCREDITED'),
  sopReference: z.string().trim().max(255).optional(),
  sampleTypeIds: z.array(z.string().uuid('Sample type ID must be a valid UUID.')).optional(),
  parameters: z
    .array(MethodParameterItemSchema)
    .refine(
      (items) => {
        const ids = new Set<string>();
        for (const item of items) {
          if (ids.has(item.parameterId)) {
            return false;
          }
          ids.add(item.parameterId);
        }
        return true;
      },
      {
        message: 'Duplicate parameter IDs are not permitted in method parameter configuration.',
      },
    )
    .optional(),
});

export type CreateMethodDto = z.infer<typeof CreateMethodSchema>;
