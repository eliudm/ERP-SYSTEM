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
import {
  SerialNumbersService,
  CreateSerialDto,
} from '../services/serial-numbers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/serials')
export class SerialNumbersController {
  constructor(private serialsService: SerialNumbersService) {}

  @ApiOperation({ summary: 'Create a single serial number for a product' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateSerialDto) {
    return this.serialsService.create(dto);
  }

  @ApiOperation({ summary: 'Create multiple serial numbers for a product in a warehouse at once' })
  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  bulkCreate(
    @Body('productId') productId: string,
    @Body('serials') serials: string[],
    @Body('warehouseId') warehouseId: string,
  ) {
    return this.serialsService.bulkCreate(productId, serials, warehouseId);
  }

  @ApiOperation({ summary: 'List serial numbers, optionally filtered by product or status' })
  @Get()
  findAll(
    @Query('productId') productId: string,
    @Query('status') status: string,
  ) {
    return this.serialsService.findAll(productId, status);
  }

  @ApiOperation({ summary: 'Find a serial number record by its serial value' })
  @Get(':serial')
  findBySerial(@Param('serial') serial: string) {
    return this.serialsService.findBySerial(serial);
  }

  @ApiOperation({ summary: 'Update the status and warehouse of a serial number' })
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('warehouseId') warehouseId: string,
  ) {
    return this.serialsService.updateStatus(id, status, warehouseId);
  }
}
