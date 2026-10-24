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
  RFQService,
  CreateRFQDto,
  UpdateRFQDto,
} from '../services/rfq.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/rfq')
export class RFQController {
  constructor(private rfqService: RFQService) {}

  @ApiOperation({ summary: 'Create a new request for quotation (RFQ)' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreateRFQDto) {
    return this.rfqService.create(dto);
  }

  @ApiOperation({ summary: 'List RFQs, optionally filtered by supplier and status' })
  @Get()
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    return this.rfqService.findAll(supplierId, status);
  }

  @ApiOperation({ summary: 'Get a single RFQ by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rfqService.findOne(id);
  }

  @ApiOperation({ summary: 'Update an RFQ' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  update(@Param('id') id: string, @Body() dto: UpdateRFQDto) {
    return this.rfqService.update(id, dto);
  }

  @ApiOperation({ summary: 'Send an RFQ to the supplier' })
  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  send(@Param('id') id: string) {
    return this.rfqService.send(id);
  }

  @ApiOperation({ summary: 'Confirm an RFQ' })
  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  confirm(@Param('id') id: string) {
    return this.rfqService.confirm(id);
  }

  @ApiOperation({ summary: 'Cancel an RFQ' })
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  cancel(@Param('id') id: string) {
    return this.rfqService.cancel(id);
  }

  @ApiOperation({ summary: 'Record a supplier quotation received against an RFQ' })
  @Patch(':id/receive-quotation')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  receiveQuotation(
    @Param('id') id: string,
    @Body() body: { items: { productId: string; quotedPrice: number }[] },
  ) {
    return this.rfqService.receiveQuotation(id, body.items);
  }

  @ApiOperation({ summary: 'Convert an RFQ by confirming it' })
  @Post(':id/convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  convert(@Param('id') id: string) {
    return this.rfqService.confirm(id);
  }
}
