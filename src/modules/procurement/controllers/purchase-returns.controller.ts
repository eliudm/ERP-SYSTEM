import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  PurchaseReturnsService,
  CreatePurchaseReturnDto,
} from '../services/purchase-returns.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('procurement/purchase-returns')
export class PurchaseReturnsController {
  constructor(private purchaseReturnsService: PurchaseReturnsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreatePurchaseReturnDto) {
    return this.purchaseReturnsService.create(dto);
  }

  @Get()
  findAll() {
    return this.purchaseReturnsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseReturnsService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  approve(@Param('id') id: string) {
    return this.purchaseReturnsService.approve(id);
  }
}
