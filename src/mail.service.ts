import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT') ?? 587;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP configured: ${host}:${port}`);
    } else {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
          'Emails will be logged to console only.',
      );
    }
  }

  async sendMail(options: SendMailOptions): Promise<{ preview?: string }> {
    const from =
      options.from ??
      this.config.get<string>('SMTP_FROM') ??
      '"Nexora ERP" <noreply@nexora-erp.local>';

    if (!this.transporter) {
      // Dev fallback — log to console / ethereal preview
      const testAccount = await nodemailer.createTestAccount();
      const devTransport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const info = await devTransport.sendMail({ from, ...options });
      const preview = nodemailer.getTestMessageUrl(info) as string;
      this.logger.log(`[DEV] Email preview URL: ${preview}`);
      return { preview };
    }

    await this.transporter.sendMail({ from, ...options });
    this.logger.log(`Email sent to ${options.to} — ${options.subject}`);
    return {};
  }
}
