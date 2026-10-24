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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/purchase-orders')
export class PurchaseOrdersController {
  constructor(private poService: PurchaseOrdersService) {}

  @ApiOperation({ summary: 'Create a new purchase order' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.poService.create(dto);
  }

  @ApiOperation({ summary: 'List purchase orders, optionally filtered by status, with pagination' })
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.poService.findAll(+page || 1, +limit || 20, status);
  }

  @ApiOperation({ summary: 'Get a purchase order summary for a date range' })
  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.PROCUREMENT_OFFICER)
  getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.poService.getSummary(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get a single purchase order by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.poService.findOne(id);
  }

  @ApiOperation({ summary: 'Approve a purchase order' })
  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.poService.approve(id);
  }

  @ApiOperation({ summary: 'Record receipt of goods against a purchase order' })
  @Post(':id/receive')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER, Role.PROCUREMENT_OFFICER)
  receiveGoods(@Param('id') id: string, @Body() dto: ReceiveGoodsDto) {
    return this.poService.receiveGoods(id, dto);
  }

  @ApiOperation({ summary: 'Create a vendor bill from a purchase order' })
  @Post(':id/create-bill')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.PROCUREMENT_OFFICER)
  createBill(@Param('id') id: string) {
    return this.poService.createBillFromPO(id);
  }

  @ApiOperation({ summary: 'Void a purchase order with a reason' })
  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  void(@Param('id') id: string, @Body('reason') reason: string) {
    return this.poService.void(id, reason);
  }
}
