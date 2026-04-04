import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaxRatesService } from './services/tax-rates.service';
import { TaxGroupsService } from './services/tax-groups.service';
import { TaxReportService } from './services/tax-report.service';

@UseGuards(JwtAuthGuard)
@Controller('tax')
export class TaxController {
  constructor(
    private readonly taxRatesService: TaxRatesService,
    private readonly taxGroupsService: TaxGroupsService,
    private readonly taxReportService: TaxReportService,
  ) {}

  // ─── Tax Rates ───────────────────────────────────────────────────────────────

  @Post('rates')
  createRate(
    @Body()
    body: {
      name: string;
      rate: number;
      type: string;
      isDefault?: boolean;
      glAccountId?: string;
    },
  ) {
    return this.taxRatesService.create(body);
  }

  @Get('rates')
  findAllRates(
    @Query('type') type?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.taxRatesService.findAll(type, activeOnly !== 'false');
  }

  @Get('rates/:id')
  findOneRate(@Param('id') id: string) {
    return this.taxRatesService.findOne(id);
  }

  @Patch('rates/:id')
  updateRate(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      rate: number;
      isDefault: boolean;
      glAccountId: string;
      isActive: boolean;
    }>,
  ) {
    return this.taxRatesService.update(id, body);
  }

  @Post('rates/:id/set-default')
  setDefaultRate(@Param('id') id: string) {
    return this.taxRatesService.setDefault(id);
  }

  @Post('rates/:id/deactivate')
  deactivateRate(@Param('id') id: string) {
    return this.taxRatesService.deactivate(id);
  }

  // ─── Tax Groups ──────────────────────────────────────────────────────────────

  @Post('groups')
  createGroup(
    @Body() body: { name: string; description?: string; taxRateIds: string[] },
  ) {
    return this.taxGroupsService.create(body);
  }

  @Get('groups')
  findAllGroups() {
    return this.taxGroupsService.findAll();
  }

  @Get('groups/:id')
  findOneGroup(@Param('id') id: string) {
    return this.taxGroupsService.findOne(id);
  }

  @Patch('groups/:id')
  updateGroup(
    @Param('id') id: string,
    @Body()
    body: Partial<{ name: string; description: string; taxRateIds: string[] }>,
  ) {
    return this.taxGroupsService.update(id, body);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.taxGroupsService.delete(id);
  }

  // ─── Tax Reports ─────────────────────────────────────────────────────────────

  @Get('reports/vat-return')
  getVatReturn(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.taxReportService.getVatReturn(startDate, endDate);
  }

  @Get('reports/wht')
  getWhtReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.taxReportService.getWhtReport(startDate, endDate);
  }

  @Get('reports/summary')
  getTaxSummary(@Query('year') year: string) {
    return this.taxReportService.getTaxSummary(parseInt(year));
  }
}
