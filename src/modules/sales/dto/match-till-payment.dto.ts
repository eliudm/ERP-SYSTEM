import { IsNotEmpty, IsString } from 'class-validator';

export class MatchTillPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;
}
