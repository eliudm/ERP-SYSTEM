import { Min, Max, IsInt } from 'class-validator';

export class CreatePayrollDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2020)
  year!: number;
}
