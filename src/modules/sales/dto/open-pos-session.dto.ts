import { IsOptional, IsString } from 'class-validator';

export class OpenPosSessionDto {
  @IsOptional()
  @IsString()
  branchId?: string;
}
