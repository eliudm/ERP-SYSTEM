import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '../dto';
import { ProductCategoriesService } from '../services/product-categories.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/categories')
export class ProductCategoriesController {
  constructor(private productCategoriesService: ProductCategoriesService) {}

  @ApiOperation({ summary: 'List all product categories' })
  @Get()
  findAll() {
    return this.productCategoriesService.findAll();
  }

  @ApiOperation({ summary: 'Create a new product category' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  create(@Body() dto: CreateProductCategoryDto) {
    return this.productCategoriesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a product category' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.productCategoriesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a product category' })
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  remove(@Param('id') id: string) {
    return this.productCategoriesService.remove(id);
  }
}
