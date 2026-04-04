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
import { LeaveService } from '../services/leave.service';
import { CreateLeaveDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('hr/leave')
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  create(@Body() dto: CreateLeaveDto) {
    return this.leaveService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  findAll(
    @Query('status') status: string,
    @Query('employeeId') employeeId: string,
  ) {
    return this.leaveService.findAll(status, employeeId);
  }

  @Get(':employeeId/balance')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getBalance(@Param('employeeId') employeeId: string) {
    return this.leaveService.getLeaveBalance(employeeId);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  approve(@Param('id') id: string, @GetUser('id') approverId: string) {
    return this.leaveService.approve(id, approverId);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  reject(@Param('id') id: string) {
    return this.leaveService.reject(id);
  }
}
