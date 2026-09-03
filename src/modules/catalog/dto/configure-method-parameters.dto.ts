import { z } from 'zod';
import { toDecimal } from '@/core/common/decimal';

export const MethodParameterItemSchema = z
  .object({
    parameterId: z
      .string({ required_error: 'Parameter ID is required.' })
      .uuid('Parameter ID must be a valid UUID.'),
    unitId: z
      .string({ required_error: 'Unit ID is required.' })
      .uuid('Unit ID must be a valid UUID.'),
    detectionLimit: z
      .string({ required_error: 'Detection limit is required.' })
      .trim()
      .refine(
        (val) => {
          try {
            const dec = toDecimal(val);
            return dec.isPositive() && !dec.isZero() && dec.isFinite();
          } catch {
            return false;
          }
        },
        {
          message: 'Detection limit must be a strictly positive valid decimal number.',
        },
      ),
    reportingLimit: z
      .string({ required_error: 'Reporting limit is required.' })
      .trim()
      .refine(
        (val) => {
          try {
            const dec = toDecimal(val);
            return dec.isPositive() && !dec.isZero() && dec.isFinite();
          } catch {
            return false;
          }
        },
        {
          message: 'Reporting limit must be a strictly positive valid decimal number.',
        },
      ),
    decimalPrecision: z
      .number()
      .int('Decimal precision must be an integer.')
      .min(0, 'Decimal precision cannot be negative.')
      .max(8, 'Decimal precision cannot exceed 8.')
      .default(2),
    isMandatory: z.boolean().default(true),
  })
  .refine(
    (data) => {
      try {
        const dl = toDecimal(data.detectionLimit);
        const rl = toDecimal(data.reportingLimit);
        return rl.greaterThanOrEqualTo(dl);
      } catch {
        return false;
      }
    },
    {
      message: 'Reporting limit must be greater than or equal to detection limit.',
      path: ['reportingLimit'],
    },
  );

export const ConfigureMethodParametersSchema = z.object({
  parameters: z
    .array(MethodParameterItemSchema, {
      required_error: 'Parameters array is required.',
    })
    .min(1, 'At least one parameter must be configured.')
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
    ),
});

export type MethodParameterItemDto = z.infer<typeof MethodParameterItemSchema>;
export type ConfigureMethodParametersDto = z.infer<typeof ConfigureMethodParametersSchema>;
