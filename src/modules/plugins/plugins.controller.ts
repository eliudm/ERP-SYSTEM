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
import { PluginsService } from './plugins.service';
import { RegisterPluginDto, UpdatePluginConfigDto } from './dto/plugins.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('plugins')
export class PluginsController {
  constructor(private pluginsService: PluginsService) {}

  @Post()
  register(@Body() dto: RegisterPluginDto) {
    return this.pluginsService.register(dto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.pluginsService.findAll(status);
  }

  @Get('active')
  getActivePlugins() {
    return this.pluginsService.getActivePlugins();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pluginsService.findOne(id);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.pluginsService.activate(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.pluginsService.deactivate(id);
  }

  @Patch(':id/config')
  updateConfig(@Param('id') id: string, @Body() dto: UpdatePluginConfigDto) {
    return this.pluginsService.updateConfig(id, dto);
  }

  @Delete(':id')
  uninstall(@Param('id') id: string) {
    return this.pluginsService.uninstall(id);
  }
}
