import { z } from 'zod';

export const BillingAddressSchema = z
  .object({
    street: z.string().trim().max(255).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .optional();

export const PrimaryContactSchema = z.object({
  firstName: z
    .string({ required_error: 'Primary contact first name is required.' })
    .trim()
    .min(1, 'First name cannot be empty.')
    .max(100, 'First name cannot exceed 100 characters.'),
  lastName: z
    .string({ required_error: 'Primary contact last name is required.' })
    .trim()
    .min(1, 'Last name cannot be empty.')
    .max(100, 'Last name cannot exceed 100 characters.'),
  email: z
    .string({ required_error: 'Primary contact email is required.' })
    .trim()
    .email('Invalid primary contact email format.')
    .max(255, 'Email cannot exceed 255 characters.'),
  phone: z.string().trim().max(50).optional(),
  roleTitle: z.string().trim().max(100).optional(),
});

export const RegisterCustomerSchema = z.object({
  clientCode: z
    .string({ required_error: 'Client code is required.' })
    .trim()
    .min(2, 'Client code must be at least 2 characters long.')
    .max(64, 'Client code cannot exceed 64 characters.')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Client code must contain only alphanumeric characters, underscores, or hyphens.',
    ),
  companyName: z
    .string({ required_error: 'Company name is required.' })
    .trim()
    .min(2, 'Company name must be at least 2 characters long.')
    .max(255, 'Company name cannot exceed 255 characters.'),
  billingAddress: BillingAddressSchema,
  primaryContact: PrimaryContactSchema,
});

export type RegisterCustomerDto = z.infer<typeof RegisterCustomerSchema>;
