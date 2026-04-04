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
import { ProductsService } from '../services/products.service';
import { CreateProductDto, UpdateProductDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('inventory/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productsService.findAll(search, categoryId);
  }

  @Get('low-stock')
  getLowStock() {
    return this.productsService.getLowStock();
  }

  @Get('valuation')
  getValuation() {
    return this.productsService.getStockValuation();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }
}
