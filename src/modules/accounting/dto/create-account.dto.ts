import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @IsString()
  parentId?: string;
}
