import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number; // defaults to 0.16

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;
}
