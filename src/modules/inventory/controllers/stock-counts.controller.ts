import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  StockCountsService,
  CreateStockCountDto,
} from '../services/stock-counts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('inventory/stock-counts')
export class StockCountsController {
  constructor(private stockCountsService: StockCountsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateStockCountDto) {
    return this.stockCountsService.create(dto);
  }

  @Get()
  findAll() {
    return this.stockCountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockCountsService.findOne(id);
  }

  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  start(@Param('id') id: string) {
    return this.stockCountsService.startCount(id);
  }

  @Patch(':id/lines/:productId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  updateLine(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body('countedQty') countedQty: number,
  ) {
    return this.stockCountsService.updateLine(id, productId, countedQty);
  }

  @Post(':id/validate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  validate(@Param('id') id: string) {
    return this.stockCountsService.validate(id);
  }
}
