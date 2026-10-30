import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MpesaService } from '../services/mpesa.service';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('sales')
@Controller('payments/mpesa')
export class MpesaController {
  constructor(private readonly mpesaService: MpesaService) {}

  @ApiOperation({
    summary: 'Receive and process an M-Pesa payment callback from Safaricom',
  })
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

  // ─── TILL NUMBER (C2B) ────────────────────────────────────
  // These two are called directly by Safaricom, not by our own frontend —
  // there is no JWT to guard them with, unlike /callback above (which we
  // control the URL for and added our own ?token=/HMAC signature to). C2B's
  // registered URLs carry no such mechanism; this is a limitation of the
  // protocol itself, not a shortcut taken here.

  @ApiOperation({
    summary: 'Safaricom C2B Validation callback (always accepts)',
  })
  @Post('c2b/validation')
  @HttpCode(200)
  c2bValidation() {
    return this.mpesaService.handleC2BValidation();
  }

  @ApiOperation({
    summary:
      'Safaricom C2B Confirmation callback — records an unmatched Till Number payment',
  })
  @Post('c2b/confirmation')
  @HttpCode(200)
  async c2bConfirmation(@Body() payload: unknown) {
    return this.mpesaService.handleC2BConfirmation(payload);
  }

  @ApiOperation({
    summary:
      'Register the C2B Validation/Confirmation URLs with Safaricom for the configured Till/shortcode (run once after the public callback URL changes, e.g. a new ngrok tunnel)',
  })
  @Post('c2b/register-urls')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  registerC2BUrls() {
    return this.mpesaService.registerC2BUrls();
  }
}
