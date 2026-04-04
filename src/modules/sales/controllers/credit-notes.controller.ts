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

@UseGuards(JwtAuthGuard)
@Controller('sales/credit-notes')
export class CreditNotesController {
  constructor(private creditNotesService: CreditNotesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  create(@Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(dto);
  }

  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.creditNotesService.findAll(+page || 1, +limit || 20);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creditNotesService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  approve(@Param('id') id: string) {
    return this.creditNotesService.approve(id);
  }

  @Post(':id/apply/:invoiceId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  apply(@Param('id') id: string, @Param('invoiceId') invoiceId: string) {
    return this.creditNotesService.applyToInvoice(id, invoiceId);
  }
}
