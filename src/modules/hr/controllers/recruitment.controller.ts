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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RecruitmentService } from '../services/recruitment.service';

@UseGuards(JwtAuthGuard)
@Controller('hr/recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // ─── Job Postings ──────────────────────────────────────────────────────────

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

  @Get('postings')
  findAllPostings(@Query('status') status?: string) {
    return this.recruitmentService.findAllPostings(status);
  }

  @Get('postings/:id')
  findOnePosting(@Param('id') id: string) {
    return this.recruitmentService.findOnePosting(id);
  }

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

  @Post('postings/:id/close')
  closePosting(@Param('id') id: string) {
    return this.recruitmentService.closePosting(id);
  }

  // ─── Applications ───────────────────────────────────────────────────────────

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

  @Get('applications')
  findAllApplications(
    @Query('jobPostingId') jobPostingId?: string,
    @Query('status') status?: string,
  ) {
    return this.recruitmentService.findAllApplications(jobPostingId, status);
  }

  @Get('applications/:id')
  findOneApplication(@Param('id') id: string) {
    return this.recruitmentService.findOneApplication(id);
  }

  @Post('applications/:id/shortlist')
  shortlist(@Param('id') id: string) {
    return this.recruitmentService.shortlist(id);
  }

  @Post('applications/:id/reject')
  reject(@Param('id') id: string) {
    return this.recruitmentService.reject(id);
  }

  @Post('applications/:id/offer')
  makeOffer(@Param('id') id: string) {
    return this.recruitmentService.makeOffer(id);
  }

  // ─── Interviews ─────────────────────────────────────────────────────────────

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
