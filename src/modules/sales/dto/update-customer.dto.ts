import { IsString, IsOptional, IsEmail, IsBoolean, IsNumber, Min } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxPin?: string;

  @IsOptional()
  @IsBoolean()
  creditAllowed?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;
}
