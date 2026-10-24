import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PriceListsService } from '../services/price-lists.service';
import {
  CreatePriceListDto,
  CreatePriceListItemDto,
} from '../dto/create-price-list.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/price-lists')
export class PriceListsController {
  constructor(private priceListsService: PriceListsService) {}

  @ApiOperation({ summary: 'Create a new price list' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: CreatePriceListDto) {
    return this.priceListsService.create(dto);
  }

  @ApiOperation({ summary: 'List all price lists' })
  @Get()
  findAll() {
    return this.priceListsService.findAll();
  }

  @ApiOperation({
    summary: 'Get the effective price for a product at a given quantity',
  })
  @Get('effective')
  getEffectivePrice(
    @Query('productId') productId: string,
    @Query('qty') qty: string,
  ) {
    return this.priceListsService.getEffectivePrice(productId, +qty || 1);
  }

  @ApiOperation({ summary: 'Get a price list by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.priceListsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a price list' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePriceListDto>) {
    return this.priceListsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a price list' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.priceListsService.deactivate(id);
  }

  @ApiOperation({ summary: 'Add an item to a price list' })
  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  addItem(@Param('id') id: string, @Body() dto: CreatePriceListItemDto) {
    return this.priceListsService.addItem(id, dto);
  }

  @ApiOperation({ summary: 'List items in a price list' })
  @Get(':id/items')
  getItems(@Param('id') id: string) {
    return this.priceListsService.getItems(id);
  }

  @ApiOperation({ summary: 'Remove an item from a price list' })
  @Delete('items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  removeItem(@Param('itemId') itemId: string) {
    return this.priceListsService.removeItem(itemId);
  }
}
