import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RecruitmentService } from '../services/recruitment.service';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // ─── Job Postings ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new job posting' })
  @Post('postings')
  createPosting(
    @Body()
    body: {
      title: string;
      department?: string;
      description?: string;
      requirements?: string;
      closingDate?: string;
    },
  ) {
    return this.recruitmentService.createPosting(body);
  }

  @ApiOperation({ summary: 'List job postings, optionally filtered by status' })
  @Get('postings')
  findAllPostings(@Query('status') status?: string) {
    return this.recruitmentService.findAllPostings(status);
  }

  @ApiOperation({ summary: 'Get a single job posting by id' })
  @Get('postings/:id')
  findOnePosting(@Param('id') id: string) {
    return this.recruitmentService.findOnePosting(id);
  }

  @ApiOperation({ summary: 'Update a job posting' })
  @Patch('postings/:id')
  updatePosting(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      department: string;
      description: string;
      requirements: string;
      closingDate: string;
      status: string;
    }>,
  ) {
    return this.recruitmentService.updatePosting(id, body);
  }

  @ApiOperation({ summary: 'Close a job posting' })
  @Post('postings/:id/close')
  closePosting(@Param('id') id: string) {
    return this.recruitmentService.closePosting(id);
  }

  // ─── Applications ───────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new job application' })
  @Post('applications')
  createApplication(
    @Body()
    body: {
      jobPostingId: string;
      applicantName: string;
      applicantEmail: string;
      applicantPhone?: string;
      cvUrl?: string;
      coverLetter?: string;
    },
  ) {
    return this.recruitmentService.createApplication(body);
  }

  @ApiOperation({ summary: 'List job applications, optionally filtered by job posting and status' })
  @Get('applications')
  findAllApplications(
    @Query('jobPostingId') jobPostingId?: string,
    @Query('status') status?: string,
  ) {
    return this.recruitmentService.findAllApplications(jobPostingId, status);
  }

  @ApiOperation({ summary: 'Get a single job application by id' })
  @Get('applications/:id')
  findOneApplication(@Param('id') id: string) {
    return this.recruitmentService.findOneApplication(id);
  }

  @ApiOperation({ summary: 'Shortlist a job application' })
  @Post('applications/:id/shortlist')
  shortlist(@Param('id') id: string) {
    return this.recruitmentService.shortlist(id);
  }

  @ApiOperation({ summary: 'Reject a job application' })
  @Post('applications/:id/reject')
  reject(@Param('id') id: string) {
    return this.recruitmentService.reject(id);
  }

  @ApiOperation({ summary: 'Make a job offer for an application' })
  @Post('applications/:id/offer')
  makeOffer(@Param('id') id: string) {
    return this.recruitmentService.makeOffer(id);
  }

  // ─── Interviews ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Schedule an interview for a job application' })
  @Post('interviews')
  scheduleInterview(
    @Body()
    body: {
      applicationId: string;
      scheduledAt: string;
      interviewerId: string;
      location?: string;
      notes?: string;
    },
  ) {
    return this.recruitmentService.scheduleInterview(body);
  }

  @ApiOperation({ summary: 'Record the result of an interview' })
  @Patch('interviews/:id/result')
  recordInterviewResult(
    @Param('id') id: string,
    @Body() body: { result: string; feedback?: string },
  ) {
    return this.recruitmentService.recordInterviewResult(
      id,
      body.result,
      body.feedback,
    );
  }

  // ─── Hire ───────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Hire an applicant and create their employee record' })
  @Post('applications/:id/hire')
  hire(
    @Param('id') id: string,
    @Body()
    body: {
      department: string;
      jobTitle: string;
      basicSalary: number;
      startDate?: string;
      nationalId?: string;
      phone?: string;
    },
  ) {
    return this.recruitmentService.hire(id, body);
  }
}
