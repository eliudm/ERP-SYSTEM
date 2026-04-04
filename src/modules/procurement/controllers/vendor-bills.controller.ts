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
import {
  VendorBillsService,
  CreateVendorBillDto,
} from '../services/vendor-bills.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('procurement/vendor-bills')
export class VendorBillsController {
  constructor(private vendorBillsService: VendorBillsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.ACCOUNTANT)
  create(@Body() dto: CreateVendorBillDto) {
    return this.vendorBillsService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.vendorBillsService.findAll(+page || 1, +limit || 20, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorBillsService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.vendorBillsService.approve(id);
  }

  @Post(':id/pay')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  pay(@Param('id') id: string) {
    return this.vendorBillsService.pay(id);
  }

  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(@Param('id') id: string) {
    return this.vendorBillsService.void(id);
  }
}
