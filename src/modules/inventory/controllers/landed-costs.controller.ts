import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  LandedCostsService,
  CreateLandedCostDto,
} from '../services/landed-costs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('inventory/landed-costs')
export class LandedCostsController {
  constructor(private landedCostsService: LandedCostsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreateLandedCostDto) {
    return this.landedCostsService.create(dto);
  }

  @Get()
  findAll() {
    return this.landedCostsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.landedCostsService.findOne(id);
  }

  @Post(':id/apply')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  apply(@Param('id') id: string) {
    return this.landedCostsService.apply(id);
  }
}
