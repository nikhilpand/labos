import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Inject,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PermissionsGuard } from '../../platform/auth/guards/permissions.guard';
import { RequirePermissions } from '../../platform/auth/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../platform/auth/decorators/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../platform/auth/auth.types';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe';
import { RegisterCustomerSchema, RegisterCustomerDto } from './dto/register-customer.dto';
import { CustomerRegistrationResult } from './customer.types';

@Controller('api/v1/customers')
@UseGuards(PermissionsGuard)
export class CustomerController {
  constructor(@Inject(CustomerService) private readonly customerService: CustomerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('customer:create')
  async registerCustomer(
    @Body(new ZodValidationPipe(RegisterCustomerSchema)) dto: RegisterCustomerDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: CustomerRegistrationResult }> {
    const result = await this.customerService.registerCustomer(dto, principal, correlationId);

    return { data: result };
  }
}
