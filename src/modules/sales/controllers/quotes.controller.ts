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
import { QuotesService } from '../services/quotes.service';
import { CreateQuoteDto, UpdateQuoteDto } from '../dto/create-quote.dto';
import { SendQuoteEmailDto } from '../dto/send-quote-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('sales/quotes')
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: CreateQuoteDto) {
    return this.quotesService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
    @Query('customerId') customerId: string,
  ) {
    return this.quotesService.findAll(
      +page || 1,
      +limit || 20,
      status,
      customerId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(id, dto);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  send(@Param('id') id: string) {
    return this.quotesService.send(id);
  }

  @Post(':id/convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  convert(@Param('id') id: string) {
    return this.quotesService.convertToInvoice(id);
  }

  @Post(':id/email')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  sendByEmail(@Param('id') id: string, @Body() dto: SendQuoteEmailDto) {
    return this.quotesService.sendByEmail(id, dto);
  }

  @Patch(':id/decline')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  decline(@Param('id') id: string) {
    return this.quotesService.decline(id);
  }

  @Patch(':id/expire')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  expire(@Param('id') id: string) {
    return this.quotesService.expire(id);
  }
}
