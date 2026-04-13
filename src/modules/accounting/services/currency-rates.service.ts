import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import {
  ConvertAmountDto,
  CreateCurrencyRateDto,
  UpdateCurrencyRateDto,
} from '../dto/currency-rate.dto';

@Injectable()
export class CurrencyRatesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCurrencyRateDto) {
    const baseCurrency = dto.baseCurrency.toUpperCase();
    const quoteCurrency = dto.quoteCurrency.toUpperCase();

    if (baseCurrency === quoteCurrency) {
      throw new BadRequestException(
        'Base and quote currencies cannot be the same',
      );
    }

    return this.prisma.currencyRate.create({
      data: {
        baseCurrency,
        quoteCurrency,
        rate: dto.rate,
        rateDate: new Date(dto.rateDate),
      },
    });
  }

  findAll(baseCurrency?: string, quoteCurrency?: string) {
    return this.prisma.currencyRate.findMany({
      where: {
        ...(baseCurrency && { baseCurrency: baseCurrency.toUpperCase() }),
        ...(quoteCurrency && { quoteCurrency: quoteCurrency.toUpperCase() }),
      },
      orderBy: [{ rateDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const rate = await this.prisma.currencyRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('Currency rate not found');
    return rate;
  }

  async update(id: string, dto: UpdateCurrencyRateDto) {
    await this.findOne(id);

    return this.prisma.currencyRate.update({
      where: { id },
      data: {
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.currencyRate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getLatestRate(
    baseCurrency: string,
    quoteCurrency: string,
    asOfDate?: string,
  ) {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    if (base === quote) {
      return {
        baseCurrency: base,
        quoteCurrency: quote,
        rate: 1,
        source: 'identity',
      };
    }

    const date = asOfDate ? new Date(asOfDate) : new Date();

    const latest = await this.prisma.currencyRate.findFirst({
      where: {
        baseCurrency: base,
        quoteCurrency: quote,
        isActive: true,
        rateDate: { lte: date },
      },
      orderBy: { rateDate: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException(
        `No active exchange rate found for ${base}/${quote}`,
      );
    }

    return latest;
  }

  async convert(dto: ConvertAmountDto) {
    const latest = await this.getLatestRate(
      dto.fromCurrency,
      dto.toCurrency,
      dto.asOfDate,
    );

    const rate = Number(latest.rate ?? 1);
    const converted = Number(dto.amount) * rate;

    return {
      amount: dto.amount,
      fromCurrency: dto.fromCurrency.toUpperCase(),
      toCurrency: dto.toCurrency.toUpperCase(),
      rate,
      convertedAmount: Number(converted.toFixed(2)),
      asOfDate: dto.asOfDate ?? new Date().toISOString(),
    };
  }
}
