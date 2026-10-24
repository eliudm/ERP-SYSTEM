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
import {
  StockTransfersService,
  CreateTransferDto,
} from '../services/stock-transfers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/transfers')
export class StockTransfersController {
  constructor(private transfersService: StockTransfersService) {}

  @ApiOperation({ summary: 'Create a new stock transfer between warehouses' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto);
  }

  @ApiOperation({ summary: 'List all stock transfers' })
  @Get()
  findAll() {
    return this.transfersService.findAll();
  }

  @ApiOperation({ summary: 'Get a stock transfer by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @ApiOperation({ summary: 'Complete a stock transfer' })
  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  complete(@Param('id') id: string) {
    return this.transfersService.complete(id);
  }

  @ApiOperation({ summary: 'Cancel a stock transfer' })
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  cancel(@Param('id') id: string) {
    return this.transfersService.cancel(id);
  }
}
