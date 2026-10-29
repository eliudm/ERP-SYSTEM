import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateExpenseDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  payee!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Passed to approve() so the caller indicates, at approval time, whether
// this expense was already paid (posts straight to PAID) or is payable
// (posts to Accounts Payable, awaiting a later pay() call).
export class ApproveExpenseDto {
  @IsOptional()
  @IsBoolean()
  alreadyPaid?: boolean;

  // Required when alreadyPaid is true, or when paying a payable expense
  // via pay() — the cash/bank ASSET account the money moved through.
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class PayExpenseDto {
  @IsString()
  @IsNotEmpty()
  cashAccountId!: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
