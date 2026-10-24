import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PluginsService } from './plugins.service';
import { RegisterPluginDto, UpdatePluginConfigDto } from './dto/plugins.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('plugins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('plugins')
export class PluginsController {
  constructor(private pluginsService: PluginsService) {}

  @ApiOperation({ summary: 'Register a new plugin' })
  @Post()
  register(@Body() dto: RegisterPluginDto) {
    return this.pluginsService.register(dto);
  }

  @ApiOperation({ summary: 'List all plugins, optionally filtered by status' })
  @Get()
  findAll(@Query('status') status?: string) {
    return this.pluginsService.findAll(status);
  }

  @ApiOperation({ summary: 'Get all currently active plugins' })
  @Get('active')
  getActivePlugins() {
    return this.pluginsService.getActivePlugins();
  }

  @ApiOperation({ summary: 'Get a single plugin by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pluginsService.findOne(id);
  }

  @ApiOperation({ summary: 'Activate a plugin' })
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.pluginsService.activate(id);
  }

  @ApiOperation({ summary: 'Deactivate a plugin' })
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.pluginsService.deactivate(id);
  }

  @ApiOperation({ summary: 'Update a plugin\'s configuration' })
  @Patch(':id/config')
  updateConfig(@Param('id') id: string, @Body() dto: UpdatePluginConfigDto) {
    return this.pluginsService.updateConfig(id, dto);
  }

  @ApiOperation({ summary: 'Uninstall a plugin' })
  @Delete(':id')
  uninstall(@Param('id') id: string) {
    return this.pluginsService.uninstall(id);
  }
}
