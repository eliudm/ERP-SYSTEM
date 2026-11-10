import { Injectable, Logger } from '@nestjs/common';

interface AtSmsResult {
  SMSMessageData?: {
    Recipients?: Array<{ number: string; status: string; messageId: string; cost: string }>;
  };
}

@Injectable()
export class AfricasTalkingService {
  private readonly logger = new Logger(AfricasTalkingService.name);

  private getClient(apiKey: string, username: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AT = require('africastalking');
    return AT({ apiKey, username });
  }

  async sendSms(opts: {
    apiKey: string;
    username: string;
    senderId?: string;
    to: string[];
    message: string;
  }): Promise<Array<{ number: string; status: string; messageId?: string; error?: string }>> {
    try {
      const at = this.getClient(opts.apiKey, opts.username);
      const sms = at.SMS;
      const result: AtSmsResult = await sms.send({
        to: opts.to,
        message: opts.message,
        from: opts.senderId || undefined,
      });
      const recipients = result.SMSMessageData?.Recipients ?? [];
      return recipients.map((r) => ({
        number: r.number,
        status: r.status === 'Success' ? 'SENT' : 'FAILED',
        messageId: r.messageId,
      }));
    } catch (err) {
      this.logger.error('Africa\'s Talking SMS error', err);
      return opts.to.map((n) => ({ number: n, status: 'FAILED', error: String(err) }));
    }
  }

  async sendWhatsApp(opts: {
    apiKey: string;
    username: string;
    from: string;
    to: string[];
    message: string;
  }): Promise<Array<{ number: string; status: string; messageId?: string; error?: string }>> {
    try {
      const at = this.getClient(opts.apiKey, opts.username);
      const results: Array<{ number: string; status: string; messageId?: string; error?: string }> = [];
      // Africa's Talking WhatsApp API sends one at a time
      for (const number of opts.to) {
        try {
          const response = await at.WHATSAPP.send({
            from: opts.from,
            to: number,
            message: { type: 'text', text: { body: opts.message } },
          });
          results.push({ number, status: 'SENT', messageId: response?.id });
        } catch (err) {
          results.push({ number, status: 'FAILED', error: String(err) });
        }
      }
      return results;
    } catch (err) {
      this.logger.error('Africa\'s Talking WhatsApp error', err);
      return opts.to.map((n) => ({ number: n, status: 'FAILED', error: String(err) }));
    }
  }
}
