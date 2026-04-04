import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class SendQuoteEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}
