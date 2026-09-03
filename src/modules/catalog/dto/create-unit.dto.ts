import { z } from 'zod';

export const CreateUnitSchema = z.object({
  symbol: z
    .string({ required_error: 'Unit symbol is required.' })
    .trim()
    .min(1, 'Unit symbol cannot be empty.')
    .max(32, 'Unit symbol cannot exceed 32 characters.'),
  name: z
    .string({ required_error: 'Unit name is required.' })
    .trim()
    .min(1, 'Unit name cannot be empty.')
    .max(100, 'Unit name cannot exceed 100 characters.'),
  category: z
    .string({ required_error: 'Unit category is required.' })
    .trim()
    .min(1, 'Unit category cannot be empty.')
    .max(50, 'Unit category cannot exceed 50 characters.'),
});

export type CreateUnitDto = z.infer<typeof CreateUnitSchema>;
