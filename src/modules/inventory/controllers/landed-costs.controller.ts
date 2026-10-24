import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LandedCostsService,
  CreateLandedCostDto,
} from '../services/landed-costs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/landed-costs')
export class LandedCostsController {
  constructor(private landedCostsService: LandedCostsService) {}

  @ApiOperation({ summary: 'Create a landed cost record for allocation across items' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreateLandedCostDto) {
    return this.landedCostsService.create(dto);
  }

  @ApiOperation({ summary: 'List all landed cost records' })
  @Get()
  findAll() {
    return this.landedCostsService.findAll();
  }

  @ApiOperation({ summary: 'Get a landed cost record by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.landedCostsService.findOne(id);
  }

  @ApiOperation({ summary: 'Apply a landed cost allocation to its related items' })
  @Post(':id/apply')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  apply(@Param('id') id: string) {
    return this.landedCostsService.apply(id);
  }
}
