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
import { LotsService, CreateLotDto } from '../services/lots.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/lots')
export class LotsController {
  constructor(private lotsService: LotsService) {}

  @ApiOperation({ summary: 'Create a new product lot' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateLotDto) {
    return this.lotsService.create(dto);
  }

  @ApiOperation({ summary: 'List lots, optionally filtered by product' })
  @Get()
  findAll(@Query('productId') productId: string) {
    return this.lotsService.findAll(productId);
  }

  @ApiOperation({ summary: 'List lots expiring within the given number of days (default 30)' })
  @Get('expiring')
  findExpiring(@Query('days') days: string) {
    return this.lotsService.findExpiring(+days || 30);
  }

  @ApiOperation({ summary: 'Get a lot by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lotsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a lot' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: Partial<CreateLotDto>) {
    return this.lotsService.update(id, dto);
  }
}
