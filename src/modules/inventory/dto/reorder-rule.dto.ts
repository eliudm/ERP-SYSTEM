import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateReorderRuleDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  preferredSupplierId?: string;

  @IsNumber()
  @Min(0)
  reorderPoint!: number;

  @IsNumber()
  @Min(1)
  reorderQty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @IsBoolean()
  isAutomatic?: boolean;
}

export class UpdateReorderRuleDto {
  @IsOptional()
  @IsString()
  preferredSupplierId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  reorderQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @IsBoolean()
  isAutomatic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
