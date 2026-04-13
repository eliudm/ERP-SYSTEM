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

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

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

  @Get('pipeline')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  getPipeline() {
    return this.crmService.getPipeline();
  }

  @Get('leads/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  findLead(@Param('id') id: string) {
    return this.crmService.findLead(id);
  }

  @Post('leads')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  createLead(@Body() dto: CreateLeadDto, @Req() req: any) {
    return this.crmService.createLead(dto, req.user?.id);
  }

  @Patch('leads/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.crmService.updateLead(id, dto);
  }

  @Patch('leads/:id/stage')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  @AllowPosUser()
  updateStage(@Param('id') id: string, @Body() dto: UpdateLeadStageDto) {
    return this.crmService.updateStage(id, dto.stage);
  }

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
