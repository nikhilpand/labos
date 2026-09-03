import { z } from 'zod';

export const CasNumberRegex = /^\d{2,7}-\d{2}-\d$/;

export const CreateParameterSchema = z.object({
  code: z
    .string({ required_error: 'Parameter code is required.' })
    .trim()
    .min(1, 'Parameter code cannot be empty.')
    .max(64, 'Parameter code cannot exceed 64 characters.')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Parameter code must contain only alphanumeric characters, underscores, or hyphens.',
    ),
  name: z
    .string({ required_error: 'Parameter name is required.' })
    .trim()
    .min(1, 'Parameter name cannot be empty.')
    .max(255, 'Parameter name cannot exceed 255 characters.'),
  chemicalFormula: z.string().trim().max(64).optional(),
  casNumber: z
    .string()
    .trim()
    .regex(
      CasNumberRegex,
      'Invalid CAS registry number format. Expected format: 2-7 digits, hyphen, 2 digits, hyphen, 1 digit (e.g. 7439-92-1).',
    )
    .optional(),
  description: z.string().trim().max(1000).optional(),
});

export type CreateParameterDto = z.infer<typeof CreateParameterSchema>;
