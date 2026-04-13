import { Module } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { FeatureFlagsController } from './feature-flags.controller';
import { PluginsService } from './plugins.service';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  controllers: [PluginsController, FeatureFlagsController],
  providers: [PluginsService, FeatureFlagsService],
  exports: [PluginsService, FeatureFlagsService],
})
export class PluginsModule {}
