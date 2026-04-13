import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateCurrencyRateDto {
  @IsString()
  @Length(3, 3)
  baseCurrency!: string;

  @IsString()
  @Length(3, 3)
  quoteCurrency!: string;

  @IsNumber()
  @Min(0.000001)
  rate!: number;

  @IsDateString()
  rateDate!: string;
}

export class UpdateCurrencyRateDto {
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ConvertAmountDto {
  @IsNumber()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  fromCurrency!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  toCurrency!: string;

  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
