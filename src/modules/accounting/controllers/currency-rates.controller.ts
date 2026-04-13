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

@UseGuards(JwtAuthGuard)
@Controller('accounting/currency-rates')
export class CurrencyRatesController {
  constructor(private readonly currencyRatesService: CurrencyRatesService) {}

  @Get()
  findAll(
    @Query('baseCurrency') baseCurrency?: string,
    @Query('quoteCurrency') quoteCurrency?: string,
  ) {
    return this.currencyRatesService.findAll(baseCurrency, quoteCurrency);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currencyRatesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create(@Body() dto: CreateCurrencyRateDto) {
    return this.currencyRatesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyRateDto) {
    return this.currencyRatesService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  deactivate(@Param('id') id: string) {
    return this.currencyRatesService.deactivate(id);
  }

  @Post('convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  convert(@Body() dto: ConvertAmountDto) {
    return this.currencyRatesService.convert(dto);
  }
}
