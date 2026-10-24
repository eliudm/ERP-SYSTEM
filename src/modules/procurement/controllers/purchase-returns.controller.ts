import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  PurchaseReturnsService,
  CreatePurchaseReturnDto,
} from '../services/purchase-returns.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/purchase-returns')
export class PurchaseReturnsController {
  constructor(private purchaseReturnsService: PurchaseReturnsService) {}

  @ApiOperation({ summary: 'Create a new purchase return' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreatePurchaseReturnDto) {
    return this.purchaseReturnsService.create(dto);
  }

  @ApiOperation({ summary: 'List all purchase returns' })
  @Get()
  findAll() {
    return this.purchaseReturnsService.findAll();
  }

  @ApiOperation({ summary: 'Get a single purchase return by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseReturnsService.findOne(id);
  }

  @ApiOperation({ summary: 'Approve a purchase return' })
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  approve(@Param('id') id: string) {
    return this.purchaseReturnsService.approve(id);
  }
}
