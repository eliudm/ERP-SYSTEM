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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/vendor-bills')
export class VendorBillsController {
  constructor(private vendorBillsService: VendorBillsService) {}

  @ApiOperation({ summary: 'Create a new vendor bill' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.ACCOUNTANT)
  create(@Body() dto: CreateVendorBillDto) {
    return this.vendorBillsService.create(dto);
  }

  @ApiOperation({ summary: 'List vendor bills, optionally filtered by status, with pagination' })
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
  ) {
    return this.vendorBillsService.findAll(+page || 1, +limit || 20, status);
  }

  @ApiOperation({ summary: 'Get a single vendor bill by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorBillsService.findOne(id);
  }

  @ApiOperation({ summary: 'Approve a vendor bill' })
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.vendorBillsService.approve(id);
  }

  @ApiOperation({ summary: 'Pay a vendor bill' })
  @Post(':id/pay')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  pay(@Param('id') id: string) {
    return this.vendorBillsService.pay(id);
  }

  @ApiOperation({ summary: 'Void a vendor bill' })
  @Patch(':id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  void(@Param('id') id: string) {
    return this.vendorBillsService.void(id);
  }
}
