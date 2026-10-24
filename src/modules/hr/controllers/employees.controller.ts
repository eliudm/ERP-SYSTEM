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
import { EmployeesService } from '../services/employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @ApiOperation({ summary: 'Create a new employee record' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @ApiOperation({ summary: 'List employees, optionally filtered by search term and department' })
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER, Role.ACCOUNTANT)
  findAll(
    @Query('search') search: string,
    @Query('department') department: string,
  ) {
    return this.employeesService.findAll(search, department);
  }

  @ApiOperation({ summary: 'Get the total employee headcount' })
  @Get('headcount')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getHeadcount() {
    return this.employeesService.getHeadcount();
  }

  @ApiOperation({ summary: 'List all distinct employee departments' })
  @Get('departments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  @ApiOperation({ summary: 'Get a single employee by id' })
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update an employee record' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Terminate an employee' })
  @Patch(':id/terminate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  terminate(@Param('id') id: string) {
    return this.employeesService.terminate(id);
  }
}
