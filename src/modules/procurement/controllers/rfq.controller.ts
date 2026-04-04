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
import { RFQService, CreateRFQDto } from '../services/rfq.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('procurement/rfq')
export class RFQController {
  constructor(private rfqService: RFQService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  create(@Body() dto: CreateRFQDto) {
    return this.rfqService.create(dto);
  }

  @Get()
  findAll(@Query('supplierId') supplierId: string) {
    return this.rfqService.findAll(supplierId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rfqService.findOne(id);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  send(@Param('id') id: string) {
    return this.rfqService.send(id);
  }

  @Patch(':id/receive-quotation')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  receiveQuotation(
    @Param('id') id: string,
    @Body() body: { items: { productId: string; quotedPrice: number }[] },
  ) {
    return this.rfqService.receiveQuotation(id, body.items);
  }

  @Post(':id/convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROCUREMENT_OFFICER)
  convert(@Param('id') id: string) {
    return this.rfqService.convertToPO(id);
  }
}
