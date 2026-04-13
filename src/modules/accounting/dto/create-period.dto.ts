import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreatePeriodDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
