import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalEntityType, ApprovalStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkflowService } from './workflow.service';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

class CreateApprovalRequestDto {
  @IsEnum(ApprovalEntityType)
  entityType!: ApprovalEntityType;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

class ApproveRequestDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

class RejectRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflow/requests')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @ApiOperation({ summary: 'List approval requests, optionally filtered by entity type, entity id, and status' })
  @Get()
  findAll(
    @Query('entityType') entityType?: ApprovalEntityType,
    @Query('entityId') entityId?: string,
    @Query('status') status?: ApprovalStatus,
  ) {
    return this.workflowService.findRequests(entityType, entityId, status);
  }

  @ApiOperation({ summary: 'Create a new approval request for an entity' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    Role.ADMIN,
    Role.ACCOUNTANT,
    Role.SALES_USER,
    Role.PROCUREMENT_OFFICER,
    Role.HR_MANAGER,
  )
  create(@Body() dto: CreateApprovalRequestDto, @Req() req: any) {
    return this.workflowService.createApprovalRequest(
      dto.entityType,
      dto.entityId,
      req.user?.id,
      dto.comments,
      dto.dueAt ? new Date(dto.dueAt) : undefined,
    );
  }

  @ApiOperation({ summary: 'Escalate overdue pending approval requests' })
  @Post('run-overdue-check')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  runOverdueCheck() {
    return this.workflowService.escalateOverduePendingRequests();
  }

  @ApiOperation({ summary: 'Approve an approval request' })
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.PROCUREMENT_OFFICER, Role.HR_MANAGER)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRequestDto,
    @Req() req: any,
  ) {
    return this.workflowService.approveRequest(
      id,
      req.user?.id,
      dto.comments,
      req.user?.role,
    );
  }

  @ApiOperation({ summary: 'Reject an approval request' })
  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.PROCUREMENT_OFFICER, Role.HR_MANAGER)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRequestDto,
    @Req() req: any,
  ) {
    return this.workflowService.rejectRequest(
      id,
      req.user?.id,
      dto.reason,
      req.user?.role,
    );
  }
}
