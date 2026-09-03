import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Inject,
} from '@nestjs/common';
import { TestRequestService } from './test-request.service';
import { PermissionsGuard } from '../../platform/auth/guards/permissions.guard';
import { RequirePermissions } from '../../platform/auth/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../platform/auth/decorators/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../platform/auth/auth.types';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe';
import { CreateTestRequestSchema, CreateTestRequestDto } from './dto/create-test-request.dto';
import { CancelTestRequestSchema, CancelTestRequestDto } from './dto/cancel-test-request.dto';
import { TestRequestDetail, TestRequestStatus } from './test-request.types';

@Controller('api/v1/test-requests')
@UseGuards(PermissionsGuard)
export class TestRequestController {
  constructor(
    @Inject(TestRequestService) private readonly testRequestService: TestRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('test_request:create')
  async createTestRequest(
    @Body(new ZodValidationPipe(CreateTestRequestSchema)) dto: CreateTestRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: TestRequestDetail & { auditEventId: string } }> {
    const result = await this.testRequestService.createTestRequest(dto, principal, correlationId);
    return { data: result };
  }

  @Get(':id')
  @RequirePermissions('test_request:read')
  async getRequestById(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: TestRequestDetail }> {
    const result = await this.testRequestService.getRequestById(id, principal);
    return { data: result };
  }

  @Get()
  @RequirePermissions('test_request:read')
  async getRequests(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('customerId') customerId?: string,
    @Query('status') status?: TestRequestStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    data: TestRequestDetail[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const { requests, total } = await this.testRequestService.getRequests(
      {
        customerId,
        status,
        limit: parsedLimit,
        offset: parsedOffset,
      },
      principal,
    );

    return {
      data: requests,
      meta: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('test_request:cancel')
  async cancelTestRequest(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CancelTestRequestSchema)) dto: CancelTestRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: TestRequestDetail & { auditEventId: string } }> {
    const result = await this.testRequestService.cancelTestRequest(
      id,
      dto,
      principal,
      correlationId,
    );
    return { data: result };
  }
}
