import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreditNotesService } from '../services/credit-notes.service';
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/credit-notes')
export class CreditNotesController {
  constructor(private creditNotesService: CreditNotesService) {}

  @ApiOperation({ summary: 'Create a new credit note' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  create(@Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(dto);
  }

  @ApiOperation({ summary: 'List credit notes with pagination' })
  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.creditNotesService.findAll(+page || 1, +limit || 20);
  }

  @ApiOperation({ summary: 'Get a credit note by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creditNotesService.findOne(id);
  }

  @ApiOperation({ summary: 'Approve a credit note' })
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.creditNotesService.approve(id);
  }

  @ApiOperation({ summary: 'Apply a credit note to an invoice' })
  @Post(':id/apply/:invoiceId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  apply(@Param('id') id: string, @Param('invoiceId') invoiceId: string) {
    return this.creditNotesService.applyToInvoice(id, invoiceId);
  }
}
