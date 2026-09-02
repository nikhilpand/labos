import { describe, it, expect } from 'vitest';
import {
  BadRequestProblem,
  NotFoundProblem,
  ConflictProblem,
} from '@/core/errors/rfc7807.exception';
import { HttpStatus } from '@nestjs/common';

describe('RFC 7807 Problem Details Exceptions', () => {
  it('should format BadRequestProblem with machine-readable code and status', () => {
    const error = new BadRequestProblem('Customer registration payload was invalid.', [
      { name: 'name', reason: 'Customer legal name is required' },
    ]);

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.detail).toBe('Customer registration payload was invalid.');
    expect(error.invalidParams).toHaveLength(1);
    expect(error.invalidParams?.[0]?.name).toBe('name');
  });

  it('should format NotFoundProblem with stable resource code', () => {
    const error = new NotFoundProblem('Customer', 'cust-123');

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.detail).toContain("Customer with identifier 'cust-123' was not found");
  });

  it('should format ConflictProblem with conflict status code', () => {
    const error = new ConflictProblem('Customer with this legal name already exists.');

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe('CONFLICT');
  });
});
