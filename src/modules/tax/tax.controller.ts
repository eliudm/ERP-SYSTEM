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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaxRatesService } from './services/tax-rates.service';
import { TaxGroupsService } from './services/tax-groups.service';
import { TaxReportService } from './services/tax-report.service';

@ApiTags('tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tax')
export class TaxController {
  constructor(
    private readonly taxRatesService: TaxRatesService,
    private readonly taxGroupsService: TaxGroupsService,
    private readonly taxReportService: TaxReportService,
  ) {}

  // ─── Tax Rates ───────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new tax rate' })
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

  @ApiOperation({ summary: 'List tax rates, optionally filtered by type and active status' })
  @Get('rates')
  findAllRates(
    @Query('type') type?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.taxRatesService.findAll(type, activeOnly !== 'false');
  }

  @ApiOperation({ summary: 'Get a single tax rate by id' })
  @Get('rates/:id')
  findOneRate(@Param('id') id: string) {
    return this.taxRatesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a tax rate' })
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

  @ApiOperation({ summary: 'Set a tax rate as the default for its type' })
  @Post('rates/:id/set-default')
  setDefaultRate(@Param('id') id: string) {
    return this.taxRatesService.setDefault(id);
  }

  @ApiOperation({ summary: 'Deactivate a tax rate' })
  @Post('rates/:id/deactivate')
  deactivateRate(@Param('id') id: string) {
    return this.taxRatesService.deactivate(id);
  }

  // ─── Tax Groups ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new tax group from a set of tax rates' })
  @Post('groups')
  createGroup(
    @Body() body: { name: string; description?: string; taxRateIds: string[] },
  ) {
    return this.taxGroupsService.create(body);
  }

  @ApiOperation({ summary: 'List all tax groups' })
  @Get('groups')
  findAllGroups() {
    return this.taxGroupsService.findAll();
  }

  @ApiOperation({ summary: 'Get a single tax group by id' })
  @Get('groups/:id')
  findOneGroup(@Param('id') id: string) {
    return this.taxGroupsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a tax group' })
  @Patch('groups/:id')
  updateGroup(
    @Param('id') id: string,
    @Body()
    body: Partial<{ name: string; description: string; taxRateIds: string[] }>,
  ) {
    return this.taxGroupsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a tax group' })
  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.taxGroupsService.delete(id);
  }

  // ─── Tax Reports ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Generate a VAT return report for a date range' })
  @Get('reports/vat-return')
  getVatReturn(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.taxReportService.getVatReturn(startDate, endDate);
  }

  @ApiOperation({ summary: 'Generate a withholding tax (WHT) report for a date range' })
  @Get('reports/wht')
  getWhtReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.taxReportService.getWhtReport(startDate, endDate);
  }

  @ApiOperation({ summary: 'Get a yearly tax summary' })
  @Get('reports/summary')
  getTaxSummary(@Query('year') year: string) {
    return this.taxReportService.getTaxSummary(parseInt(year));
  }
}
