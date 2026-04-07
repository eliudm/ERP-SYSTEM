import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class InitiateMpesaPaymentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(254|0)\d{9}$/, {
    message: 'phoneNumber must be a valid Kenyan number e.g. 2547XXXXXXXX',
  })
  phoneNumber: string;

  @IsOptional()
  @IsString()
  accountReference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
