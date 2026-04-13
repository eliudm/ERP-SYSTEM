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
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/plugins.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(dto);
  }

  @Get()
  findAll() {
    return this.featureFlagsService.findAll();
  }

  @Get('enabled')
  getAllEnabled() {
    return this.featureFlagsService.getAllEnabled();
  }

  @Get(':key/check')
  isEnabled(@Param('key') key: string) {
    return this.featureFlagsService.isEnabled(key);
  }

  @Patch(':key/toggle')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  toggle(@Param('key') key: string) {
    return this.featureFlagsService.toggle(key);
  }

  @Patch(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('key') key: string,
    @Body() data: { name?: string; description?: string; metadata?: any },
  ) {
    return this.featureFlagsService.update(key, data);
  }

  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('key') key: string) {
    return this.featureFlagsService.remove(key);
  }
}
