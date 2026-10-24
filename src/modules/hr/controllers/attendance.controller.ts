import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AttendanceService } from '../services/attendance.service';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiOperation({ summary: 'Clock in an employee' })
  @Post('clock-in')
  clockIn(@Body() body: { employeeId: string; notes?: string }) {
    return this.attendanceService.clockIn(body.employeeId, body.notes);
  }

  @ApiOperation({ summary: 'Clock out an employee' })
  @Post('clock-out')
  clockOut(@Body() body: { employeeId: string; notes?: string }) {
    return this.attendanceService.clockOut(body.employeeId, body.notes);
  }

  @ApiOperation({ summary: 'List attendance records, optionally filtered by employee and date range' })
  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.findAll(employeeId, startDate, endDate);
  }

  @ApiOperation({ summary: 'Get an employee attendance summary for a given month and year' })
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

  @ApiOperation({ summary: 'Bulk import attendance records' })
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
