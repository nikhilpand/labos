import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { BadRequestProblem } from '../errors/rfc7807.exception';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const invalidParams = result.error.errors.map((err) => ({
        name: err.path.join('.') || 'payload',
        reason: err.message,
      }));

      throw new BadRequestProblem('Request payload failed schema validation.', invalidParams);
    }

    return result.data;
  }
}
