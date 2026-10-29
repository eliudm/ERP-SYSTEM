import { IsObject, IsOptional, IsString } from 'class-validator';

export class ClosePosSessionDto {
  @IsOptional()
  @IsString()
  closingNote?: string;

  // Per-payment-method counted cash, e.g. { CASH: 1200, CARD: 450 } — shape
  // is intentionally loose (keyed by whatever payment methods the till used)
  // rather than a fixed DTO, matching what POSPage.tsx already collects.
  @IsOptional()
  @IsObject()
  closingCounts?: Record<string, number>;
}
