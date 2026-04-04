import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
