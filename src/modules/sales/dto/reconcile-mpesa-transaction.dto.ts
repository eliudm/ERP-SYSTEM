import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class ReconcileMpesaTransactionDto {
  @IsString()
  @IsNotEmpty()
  receiptNumber: string;

  @IsOptional()
  @IsString()
  @Matches(/^(254|0)\d{9}$/, {
    message: 'phoneNumber must be a valid Kenyan number e.g. 2547XXXXXXXX',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
