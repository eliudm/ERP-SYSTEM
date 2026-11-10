import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export enum MessageChannelDto {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export class UpdateMessagingSettingsDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  senderId?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;
}

export class CreateCampaignDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(1600)
  message: string;

  @IsEnum(MessageChannelDto)
  channel: MessageChannelDto;

  @IsOptional()
  @IsString()
  segmentId?: string; // use a saved segment instead of manual recipients

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[]; // phone numbers (required if no segmentId)
}

export class SendQuickMessageDto {
  @IsString()
  recipient: string;

  @IsString()
  @MaxLength(1600)
  message: string;

  @IsEnum(MessageChannelDto)
  channel: MessageChannelDto;
}

export class SendRemindersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  customerIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1600)
  customMessage?: string;

  @IsEnum(MessageChannelDto)
  channel: MessageChannelDto;
}
