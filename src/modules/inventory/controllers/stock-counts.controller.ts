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
  StockCountsService,
  CreateStockCountDto,
} from '../services/stock-counts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/stock-counts')
export class StockCountsController {
  constructor(private stockCountsService: StockCountsService) {}

  @ApiOperation({ summary: 'Create a new stock count' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateStockCountDto) {
    return this.stockCountsService.create(dto);
  }

  @ApiOperation({ summary: 'List all stock counts' })
  @Get()
  findAll() {
    return this.stockCountsService.findAll();
  }

  @ApiOperation({ summary: 'Get a stock count by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockCountsService.findOne(id);
  }

  @ApiOperation({ summary: 'Start a stock count' })
  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  start(@Param('id') id: string) {
    return this.stockCountsService.startCount(id);
  }

  @ApiOperation({ summary: 'Record the counted quantity for a product line in a stock count' })
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

  @ApiOperation({ summary: 'Validate a stock count and reconcile stock discrepancies' })
  @Post(':id/validate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  validate(@Param('id') id: string) {
    return this.stockCountsService.validate(id);
  }
}
