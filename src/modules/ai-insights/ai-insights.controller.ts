import { Controller, Get, UseGuards } from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ACCOUNTANT)
@Controller('ai-insights')
export class AiInsightsController {
  constructor(private aiInsightsService: AiInsightsService) {}

  @Get()
  getInsights() {
    return this.aiInsightsService.getInsights();
  }
}
