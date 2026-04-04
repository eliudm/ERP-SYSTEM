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

@UseGuards(JwtAuthGuard)
@Controller('sales/price-lists')
export class PriceListsController {
  constructor(private priceListsService: PriceListsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: CreatePriceListDto) {
    return this.priceListsService.create(dto);
  }

  @Get()
  findAll() {
    return this.priceListsService.findAll();
  }

  @Get('effective')
  getEffectivePrice(
    @Query('productId') productId: string,
    @Query('qty') qty: string,
  ) {
    return this.priceListsService.getEffectivePrice(productId, +qty || 1);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.priceListsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePriceListDto>) {
    return this.priceListsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.priceListsService.deactivate(id);
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  addItem(@Param('id') id: string, @Body() dto: CreatePriceListItemDto) {
    return this.priceListsService.addItem(id, dto);
  }

  @Get(':id/items')
  getItems(@Param('id') id: string) {
    return this.priceListsService.getItems(id);
  }

  @Delete('items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  removeItem(@Param('itemId') itemId: string) {
    return this.priceListsService.removeItem(itemId);
  }
}
