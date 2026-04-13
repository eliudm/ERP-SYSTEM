import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RecurringInvoicesService } from '../services/recurring-invoices.service';
import { CreateRecurringInvoiceTemplateDto } from '../dto/recurring/create-recurring-invoice-template.dto';
import { UpdateRecurringInvoiceTemplateDto } from '../dto/recurring/update-recurring-invoice-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('sales/recurring-invoices')
export class RecurringInvoicesController {
  constructor(
    private readonly recurringInvoicesService: RecurringInvoicesService,
  ) {}

  @Get('templates')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  findTemplates(@Query('isActive') isActive?: string) {
    return this.recurringInvoicesService.findTemplates(isActive);
  }

  @Get('templates/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.SALES_USER)
  findTemplate(@Param('id') id: string) {
    return this.recurringInvoicesService.findTemplate(id);
  }

  @Post('templates')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  createTemplate(
    @Body() dto: CreateRecurringInvoiceTemplateDto,
    @Req() req: any,
  ) {
    return this.recurringInvoicesService.createTemplate(dto, req.user?.id);
  }

  @Patch('templates/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringInvoiceTemplateDto,
    @Req() req: any,
  ) {
    return this.recurringInvoicesService.updateTemplate(id, dto, req.user?.id);
  }

  @Post('run-due')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  runDue(@Req() req: any) {
    return this.recurringInvoicesService.runDueTemplates(req.user?.id);
  }
}
