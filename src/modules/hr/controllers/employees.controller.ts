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
import { EmployeesService } from '../services/employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('hr/employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  findAll(
    @Query('search') search: string,
    @Query('department') department: string,
  ) {
    return this.employeesService.findAll(search, department);
  }

  @Get('headcount')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getHeadcount() {
    return this.employeesService.getHeadcount();
  }

  @Get('departments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/terminate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  terminate(@Param('id') id: string) {
    return this.employeesService.terminate(id);
  }
}
