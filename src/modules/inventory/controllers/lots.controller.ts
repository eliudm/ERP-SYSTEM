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
import { LotsService, CreateLotDto } from '../services/lots.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('inventory/lots')
export class LotsController {
  constructor(private lotsService: LotsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateLotDto) {
    return this.lotsService.create(dto);
  }

  @Get()
  findAll(@Query('productId') productId: string) {
    return this.lotsService.findAll(productId);
  }

  @Get('expiring')
  findExpiring(@Query('days') days: string) {
    return this.lotsService.findExpiring(+days || 30);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lotsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: Partial<CreateLotDto>) {
    return this.lotsService.update(id, dto);
  }
}
