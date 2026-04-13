import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard)
@Controller('audit/logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('tableName') tableName?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.findAll(
      +page || 1,
      +limit || 50,
      tableName,
      action,
    );
  }
}
