import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Inject,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PermissionsGuard } from '../../platform/auth/guards/permissions.guard';
import { RequirePermissions } from '../../platform/auth/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../platform/auth/decorators/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../platform/auth/auth.types';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe';
import { CreateUnitSchema, CreateUnitDto } from './dto/create-unit.dto';
import { CreateSampleTypeSchema, CreateSampleTypeDto } from './dto/create-sample-type.dto';
import { CreateParameterSchema, CreateParameterDto } from './dto/create-parameter.dto';
import { CreateMethodSchema, CreateMethodDto } from './dto/create-method.dto';
import { CreateMethodVersionSchema, CreateMethodVersionDto } from './dto/create-method-version.dto';
import {
  ConfigureMethodParametersSchema,
  ConfigureMethodParametersDto,
} from './dto/configure-method-parameters.dto';
import {
  UnitOfMeasurementEntity,
  SampleTypeEntity,
  TestParameterEntity,
  TestMethodEntity,
  TestMethodVersionEntity,
  MethodVersionDetail,
  TestMethodSummary,
} from './catalog.types';

@Controller('api/v1/catalog')
@UseGuards(PermissionsGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  // ============================================================================
  // UNITS OF MEASUREMENT
  // ============================================================================

  @Get('units')
  @RequirePermissions('catalog:read')
  async getUnits(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: UnitOfMeasurementEntity[] }> {
    const units = await this.catalogService.getUnits(principal);
    return { data: units };
  }

  @Post('units')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('catalog:manage')
  async createUnit(
    @Body(new ZodValidationPipe(CreateUnitSchema)) dto: CreateUnitDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: UnitOfMeasurementEntity }> {
    const unit = await this.catalogService.createUnit(dto, principal, correlationId);
    return { data: unit };
  }

  // ============================================================================
  // SAMPLE TYPES (MATRICES)
  // ============================================================================

  @Get('sample-types')
  @RequirePermissions('catalog:read')
  async getSampleTypes(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: SampleTypeEntity[] }> {
    const sampleTypes = await this.catalogService.getSampleTypes(principal);
    return { data: sampleTypes };
  }

  @Post('sample-types')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('catalog:manage')
  async createSampleType(
    @Body(new ZodValidationPipe(CreateSampleTypeSchema)) dto: CreateSampleTypeDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: SampleTypeEntity }> {
    const sampleType = await this.catalogService.createSampleType(dto, principal, correlationId);
    return { data: sampleType };
  }

  // ============================================================================
  // TEST PARAMETERS (ANALYTES)
  // ============================================================================

  @Get('parameters')
  @RequirePermissions('catalog:read')
  async getParameters(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: TestParameterEntity[] }> {
    const parameters = await this.catalogService.getParameters(principal);
    return { data: parameters };
  }

  @Post('parameters')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('catalog:manage')
  async createParameter(
    @Body(new ZodValidationPipe(CreateParameterSchema)) dto: CreateParameterDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: TestParameterEntity }> {
    const parameter = await this.catalogService.createParameter(dto, principal, correlationId);
    return { data: parameter };
  }

  // ============================================================================
  // TEST METHODS & VERSIONS
  // ============================================================================

  @Get('methods')
  @RequirePermissions('catalog:read')
  async getMethods(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: TestMethodSummary[] }> {
    const methods = await this.catalogService.getMethods(principal);
    return { data: methods };
  }

  @Post('methods')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('catalog:manage')
  async createMethod(
    @Body(new ZodValidationPipe(CreateMethodSchema)) dto: CreateMethodDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: { method: TestMethodEntity; version: MethodVersionDetail } }> {
    const result = await this.catalogService.createMethod(dto, principal, correlationId);
    return { data: result };
  }

  @Get('methods/:id')
  @RequirePermissions('catalog:read')
  async getMethodById(
    @Param('id') testMethodId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: { method: TestMethodEntity; versions: TestMethodVersionEntity[] } }> {
    const result = await this.catalogService.getMethodById(testMethodId, principal);
    return { data: result };
  }

  @Get('methods/:id/versions/:versionId')
  @RequirePermissions('catalog:read')
  async getMethodVersionDetail(
    @Param('id') testMethodId: string,
    @Param('versionId') versionId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ data: MethodVersionDetail }> {
    const version = await this.catalogService.getMethodVersionDetail(
      testMethodId,
      versionId,
      principal,
    );
    return { data: version };
  }

  @Post('methods/:id/versions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('catalog:manage')
  async draftNewMethodVersion(
    @Param('id') testMethodId: string,
    @Body(new ZodValidationPipe(CreateMethodVersionSchema)) dto: CreateMethodVersionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: MethodVersionDetail }> {
    const version = await this.catalogService.draftNewMethodVersion(
      testMethodId,
      dto,
      principal,
      correlationId,
    );
    return { data: version };
  }

  @Put('methods/:id/versions/:versionId/parameters')
  @RequirePermissions('catalog:manage')
  async configureMethodParameters(
    @Param('id') testMethodId: string,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(ConfigureMethodParametersSchema)) dto: ConfigureMethodParametersDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: MethodVersionDetail }> {
    const version = await this.catalogService.configureMethodParameters(
      testMethodId,
      versionId,
      dto,
      principal,
      correlationId,
    );
    return { data: version };
  }

  @Post('methods/:id/versions/:versionId/activate')
  @RequirePermissions('method:approve')
  async activateMethodVersion(
    @Param('id') testMethodId: string,
    @Param('versionId') versionId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: TestMethodVersionEntity }> {
    const version = await this.catalogService.activateMethodVersion(
      testMethodId,
      versionId,
      principal,
      correlationId,
    );
    return { data: version };
  }

  @Post('methods/:id/versions/:versionId/retire')
  @RequirePermissions('method:retire')
  async retireMethodVersion(
    @Param('id') testMethodId: string,
    @Param('versionId') versionId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ data: TestMethodVersionEntity }> {
    const version = await this.catalogService.retireMethodVersion(
      testMethodId,
      versionId,
      principal,
      correlationId,
    );
    return { data: version };
  }
}
