import { IsString, Matches } from 'class-validator';

const PIN_PATTERN = /^\d{4,6}$/;
const PIN_MESSAGE = 'PIN must be 4-6 digits';

export class SetPinDto {
  @IsString()
  @Matches(PIN_PATTERN, { message: PIN_MESSAGE })
  pin!: string;
}

export class VerifyPinDto {
  @IsString()
  @Matches(PIN_PATTERN, { message: PIN_MESSAGE })
  pin!: string;
}
