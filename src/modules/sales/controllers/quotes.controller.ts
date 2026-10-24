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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/quotes')
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @ApiOperation({ summary: 'Create a new sales quote' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  create(@Body() dto: CreateQuoteDto) {
    return this.quotesService.create(dto);
  }

  @ApiOperation({
    summary: 'List quotes with pagination, optionally filtered by status and customer',
  })
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

  @ApiOperation({ summary: 'Get a quote by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a quote' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Mark a quote as sent' })
  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  send(@Param('id') id: string) {
    return this.quotesService.send(id);
  }

  @ApiOperation({ summary: 'Convert a quote into a sales invoice' })
  @Post(':id/convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  convert(@Param('id') id: string) {
    return this.quotesService.convertToInvoice(id);
  }

  @ApiOperation({ summary: 'Send a quote to the customer by email' })
  @Post(':id/email')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  sendByEmail(@Param('id') id: string, @Body() dto: SendQuoteEmailDto) {
    return this.quotesService.sendByEmail(id, dto);
  }

  @ApiOperation({ summary: 'Decline a quote' })
  @Patch(':id/decline')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SALES_USER)
  decline(@Param('id') id: string) {
    return this.quotesService.decline(id);
  }

  @ApiOperation({ summary: 'Expire a quote' })
  @Patch(':id/expire')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  expire(@Param('id') id: string) {
    return this.quotesService.expire(id);
  }
}
