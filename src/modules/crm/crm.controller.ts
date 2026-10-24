import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateLeadActivityDto,
  CreateLeadDto,
  CrmService,
  UpdateLeadDto,
  UpdateLeadStageDto,
} from './crm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AllowPosUser } from '../auth/decorators/allow-pos-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeadStage, Role } from '@prisma/client';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @ApiOperation({ summary: 'List CRM leads, optionally filtered by stage and search term' })
  @Get('leads')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  findLeads(
    @Query('stage') stage?: LeadStage,
    @Query('search') search?: string,
  ) {
    return this.crmService.findLeads(stage, search);
  }

  @ApiOperation({ summary: 'Get the lead pipeline summary (counts/value by stage)' })
  @Get('pipeline')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  getPipeline() {
    return this.crmService.getPipeline();
  }

  @ApiOperation({ summary: 'Get a single lead by id' })
  @Get('leads/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  findLead(@Param('id') id: string) {
    return this.crmService.findLead(id);
  }

  @ApiOperation({ summary: 'Create a new lead' })
  @Post('leads')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  createLead(@Body() dto: CreateLeadDto, @Req() req: any) {
    return this.crmService.createLead(dto, req.user?.id);
  }

  @ApiOperation({ summary: 'Update a lead\'s details' })
  @Patch('leads/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.crmService.updateLead(id, dto);
  }

  @ApiOperation({ summary: 'Move a lead to a different pipeline stage' })
  @Patch('leads/:id/stage')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  updateStage(@Param('id') id: string, @Body() dto: UpdateLeadStageDto) {
    return this.crmService.updateStage(id, dto.stage);
  }

  @ApiOperation({ summary: 'Add an activity entry to a lead' })
  @Post('leads/:id/activities')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  addActivity(
    @Param('id') id: string,
    @Body() dto: CreateLeadActivityDto,
    @Req() req: any,
  ) {
    return this.crmService.addActivity(id, dto, req.user?.id);
  }
}
