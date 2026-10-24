import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveService } from '../services/leave.service';
import { CreateLeaveDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/leave')
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @ApiOperation({ summary: 'Create a new leave request' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  create(@Body() dto: CreateLeaveDto) {
    return this.leaveService.create(dto);
  }

  @ApiOperation({ summary: 'List leave requests, optionally filtered by status and employee' })
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  findAll(
    @Query('status') status: string,
    @Query('employeeId') employeeId: string,
  ) {
    return this.leaveService.findAll(status, employeeId);
  }

  @ApiOperation({ summary: 'Get the leave balance for an employee' })
  @Get(':employeeId/balance')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getBalance(@Param('employeeId') employeeId: string) {
    return this.leaveService.getLeaveBalance(employeeId);
  }

  @ApiOperation({ summary: 'Approve a leave request' })
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  approve(@Param('id') id: string, @GetUser('id') approverId: string) {
    return this.leaveService.approve(id, approverId);
  }

  @ApiOperation({ summary: 'Reject a leave request' })
  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  reject(@Param('id') id: string) {
    return this.leaveService.reject(id);
  }
}
