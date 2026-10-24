import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/plugins.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('plugins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  @ApiOperation({ summary: 'Create a new feature flag (admin only)' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(dto);
  }

  @ApiOperation({ summary: 'List all feature flags' })
  @Get()
  findAll() {
    return this.featureFlagsService.findAll();
  }

  @ApiOperation({ summary: 'Get all currently enabled feature flags' })
  @Get('enabled')
  getAllEnabled() {
    return this.featureFlagsService.getAllEnabled();
  }

  @ApiOperation({ summary: 'Check whether a specific feature flag is enabled' })
  @Get(':key/check')
  isEnabled(@Param('key') key: string) {
    return this.featureFlagsService.isEnabled(key);
  }

  @ApiOperation({ summary: 'Toggle a feature flag on or off (admin only)' })
  @Patch(':key/toggle')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  toggle(@Param('key') key: string) {
    return this.featureFlagsService.toggle(key);
  }

  @ApiOperation({ summary: 'Update a feature flag\'s name, description, or metadata (admin only)' })
  @Patch(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('key') key: string,
    @Body() data: { name?: string; description?: string; metadata?: any },
  ) {
    return this.featureFlagsService.update(key, data);
  }

  @ApiOperation({ summary: 'Delete a feature flag (admin only)' })
  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('key') key: string) {
    return this.featureFlagsService.remove(key);
  }
}
