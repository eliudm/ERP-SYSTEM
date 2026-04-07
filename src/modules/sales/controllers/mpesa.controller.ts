import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { MpesaService } from '../services/mpesa.service';
import type { Request } from 'express';

@Controller('payments/mpesa')
export class MpesaController {
  constructor(private readonly mpesaService: MpesaService) {}

  @Post('callback')
  @HttpCode(200)
  async callback(
    @Body() payload: unknown,
    @Query('token') token?: string,
    @Headers('x-callback-token') headerToken?: string,
    @Headers('x-callback-signature') callbackSignature?: string,
    @Headers('x-mpesa-signature') mpesaSignature?: string,
    @Req() request?: Request,
  ) {
    await this.mpesaService.handleCallback(
      payload,
      token || headerToken,
      (request?.headers['x-forwarded-for'] as string | undefined) ||
        request?.ip,
      callbackSignature || mpesaSignature,
    );
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
