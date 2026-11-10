import { Module } from '@nestjs/common';
import { MessagingController, MessagingWebhookController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { AfricasTalkingService } from './africastalking.service';
import { InboxService } from './inbox.service';
import { SegmentationService } from './segmentation.service';

@Module({
  controllers: [MessagingWebhookController, MessagingController],
  providers: [MessagingService, AfricasTalkingService, InboxService, SegmentationService],
  exports: [MessagingService, InboxService, SegmentationService],
})
export class MessagingModule {}
