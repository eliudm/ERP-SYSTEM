import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @ValidateIf((o) => o.companyLogo !== null)
  @IsString()
  companyLogo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  companyPin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiptSlogan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultLanguage?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  autoApproveDrafts?: boolean;

  @IsOptional()
  @IsBoolean()
  showLowStockAlerts?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  posReceiptBranding?: boolean;
}
