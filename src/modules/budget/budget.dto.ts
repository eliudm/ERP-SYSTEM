import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetStatus } from '@prisma/client';

export class CreateBudgetLineDto {
  @IsString()
  accountId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBudgetDto {
  @IsString()
  name!: string;

  @IsInt()
  fiscalYear!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  lines?: CreateBudgetLineDto[];
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  fiscalYear?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetBudgetStatusDto {
  @IsEnum(BudgetStatus)
  status!: BudgetStatus;
}
