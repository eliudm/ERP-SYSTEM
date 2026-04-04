import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EtimsController } from './etims.controller';
import { EtimsService } from './etims/etims.service';
import { EtimsQueueService } from './etims-queue/etims-queue.service';
import { ETIMS_QUEUE } from './etims-queue/etims-queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({
      name: ETIMS_QUEUE,
    }),
  ],
  controllers: [EtimsController],
  providers: [EtimsService, EtimsQueueService],
  exports: [EtimsQueueService, EtimsService],
})
export class EtimsModule {}
