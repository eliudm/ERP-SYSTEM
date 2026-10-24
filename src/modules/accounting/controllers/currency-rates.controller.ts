import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrencyRatesService } from '../services/currency-rates.service';
import {
  ConvertAmountDto,
  CreateCurrencyRateDto,
  UpdateCurrencyRateDto,
} from '../dto/currency-rate.dto';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/currency-rates')
export class CurrencyRatesController {
  constructor(private readonly currencyRatesService: CurrencyRatesService) {}

  @ApiOperation({ summary: 'List currency rates, optionally filtered by base/quote currency' })
  @Get()
  findAll(
    @Query('baseCurrency') baseCurrency?: string,
    @Query('quoteCurrency') quoteCurrency?: string,
  ) {
    return this.currencyRatesService.findAll(baseCurrency, quoteCurrency);
  }

  @ApiOperation({ summary: 'Get a single currency rate by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currencyRatesService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new currency rate' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateCurrencyRateDto) {
    return this.currencyRatesService.create(dto);
  }

  @ApiOperation({ summary: 'Update an existing currency rate' })
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyRateDto) {
    return this.currencyRatesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a currency rate' })
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  deactivate(@Param('id') id: string) {
    return this.currencyRatesService.deactivate(id);
  }

  @ApiOperation({ summary: 'Convert an amount from one currency to another' })
  @Post('convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  convert(@Body() dto: ConvertAmountDto) {
    return this.currencyRatesService.convert(dto);
  }
}
