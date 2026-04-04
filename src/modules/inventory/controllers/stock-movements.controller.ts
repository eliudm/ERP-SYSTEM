import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StockMovementsService } from '../services/stock-movements.service';
import { CreateStockMovementDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('inventory/stock-movements')
export class StockMovementsController {
  constructor(private stockMovementsService: StockMovementsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateStockMovementDto) {
    return this.stockMovementsService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('productId') productId: string,
  ) {
    return this.stockMovementsService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      productId,
    );
  }

  @Get('summary')
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.stockMovementsService.getSummary(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockMovementsService.findOne(id);
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  adjust(
    @Body()
    body: {
      productId: string;
      warehouseId: string;
      newQuantity: number;
      reason: string;
    },
  ) {
    return this.stockMovementsService.adjust(
      body.productId,
      body.warehouseId,
      body.newQuantity,
      body.reason,
    );
  }
}
