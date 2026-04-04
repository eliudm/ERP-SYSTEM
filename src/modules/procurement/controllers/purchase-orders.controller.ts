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
import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { CreatePurchaseOrderDto, ReceiveGoodsDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('procurement/purchase-orders')
export class PurchaseOrdersController {
  constructor(private poService: PurchaseOrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.poService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.poService.findAll(+page || 1, +limit || 20, status);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.PROCUREMENT_OFFICER)
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.poService.getSummary(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.poService.findOne(id);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.poService.approve(id);
  }

  @Post(':id/receive')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER, Role.PROCUREMENT_OFFICER)
  receiveGoods(@Param('id') id: string, @Body() dto: ReceiveGoodsDto) {
    return this.poService.receiveGoods(id, dto);
  }

  @Post(':id/create-bill')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.PROCUREMENT_OFFICER)
  createBill(@Param('id') id: string) {
    return this.poService.createBillFromPO(id);
  }

  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  void(@Param('id') id: string, @Body('reason') reason: string) {
    return this.poService.void(id, reason);
  }
}
