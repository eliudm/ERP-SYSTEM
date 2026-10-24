import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WarehousesService } from '../services/warehouses.service';
import { CreateWarehouseDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/warehouses')
export class WarehousesController {
  constructor(private warehousesService: WarehousesService) {}

  @ApiOperation({ summary: 'Create a new warehouse' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @ApiOperation({ summary: 'List all warehouses' })
  @Get()
  findAll() {
    return this.warehousesService.findAll();
  }

  @ApiOperation({ summary: 'Get a warehouse by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @ApiOperation({ summary: 'Get the stock levels for a warehouse' })
  @Get(':id/stock')
  getWarehouseStock(@Param('id') id: string) {
    return this.warehousesService.getWarehouseStock(id);
  }

  @ApiOperation({ summary: 'Deactivate a warehouse' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.warehousesService.deactivate(id);
  }
}
