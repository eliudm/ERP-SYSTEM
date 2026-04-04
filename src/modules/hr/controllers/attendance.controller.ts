import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AttendanceService } from '../services/attendance.service';

@UseGuards(JwtAuthGuard)
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  clockIn(@Body() body: { employeeId: string; notes?: string }) {
    return this.attendanceService.clockIn(body.employeeId, body.notes);
  }

  @Post('clock-out')
  clockOut(@Body() body: { employeeId: string; notes?: string }) {
    return this.attendanceService.clockOut(body.employeeId, body.notes);
  }

  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.findAll(employeeId, startDate, endDate);
  }

  @Get('summary/:employeeId')
  getSummary(
    @Param('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.attendanceService.getSummary(
      employeeId,
      parseInt(month),
      parseInt(year),
    );
  }

  @Post('bulk-import')
  bulkImport(
    @Body()
    body: {
      records: {
        employeeId: string;
        clockIn: string;
        clockOut: string;
        notes?: string;
      }[];
    },
  ) {
    return this.attendanceService.bulkImport(body.records);
  }
}
