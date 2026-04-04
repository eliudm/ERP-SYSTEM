import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateLeaveDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
