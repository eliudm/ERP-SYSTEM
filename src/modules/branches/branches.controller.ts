import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BranchesService,
  CreateBranchDto,
  UpdateBranchDto,
} from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @ApiOperation({ summary: 'List all branches' })
  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @ApiOperation({ summary: 'Get a single branch by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @ApiOperation({ summary: 'Get a performance report for a branch over an optional date range' })
  @Get(':id/report')
  getReport(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.branchesService.getReport(id, from, to);
  }

  @ApiOperation({ summary: 'Create a new branch (admin only)' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a branch (admin only)' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a branch (admin only)' })
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.branchesService.deactivate(id);
  }
}
