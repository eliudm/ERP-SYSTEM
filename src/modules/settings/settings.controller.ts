import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOperation({ summary: 'Get the current system settings' })
  @Get('system')
  getSystemSettings() {
    return this.settingsService.getSystemSettings();
  }

  @ApiOperation({ summary: 'Update the system settings (admin only)' })
  @Patch('system')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateSystemSettings(@Body() dto: UpdateSystemSettingsDto) {
    return this.settingsService.updateSystemSettings(dto);
  }
}
