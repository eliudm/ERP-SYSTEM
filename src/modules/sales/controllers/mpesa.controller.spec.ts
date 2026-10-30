import { Test, TestingModule } from '@nestjs/testing';
import { MpesaController } from './mpesa.controller';
import { MpesaService } from '../services/mpesa.service';

const mockMpesaService = () => ({
  handleCallback: jest.fn(),
  handleC2BValidation: jest.fn(),
  handleC2BConfirmation: jest.fn(),
  registerC2BUrls: jest.fn(),
});

describe('MpesaController', () => {
  let controller: MpesaController;
  let mpesaService: ReturnType<typeof mockMpesaService>;

  beforeEach(async () => {
    mpesaService = mockMpesaService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MpesaController],
      providers: [{ provide: MpesaService, useValue: mpesaService }],
    }).compile();

    controller = module.get<MpesaController>(MpesaController);
  });

  describe('callback', () => {
    it('should forward the payload, token and ip to mpesaService.handleCallback', async () => {
      mpesaService.handleCallback.mockResolvedValue(undefined);
      const payload = { Body: { stkCallback: {} } };

      const result = await controller.callback(
        payload,
        'tok-1',
        undefined,
        undefined,
        undefined,
        { headers: {}, ip: '127.0.0.1' } as any,
      );

      expect(mpesaService.handleCallback).toHaveBeenCalledWith(
        payload,
        'tok-1',
        '127.0.0.1',
        undefined,
      );
      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });
  });

  describe('c2bValidation', () => {
    it('should call mpesaService.handleC2BValidation and return its result', () => {
      mpesaService.handleC2BValidation.mockReturnValue({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });

      const result = controller.c2bValidation();

      expect(mpesaService.handleC2BValidation).toHaveBeenCalled();
      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });
  });

  describe('c2bConfirmation', () => {
    it('should call mpesaService.handleC2BConfirmation with the payload', async () => {
      const payload = { TransID: 'ABC123' };
      mpesaService.handleC2BConfirmation.mockResolvedValue({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });

      const result = await controller.c2bConfirmation(payload);

      expect(mpesaService.handleC2BConfirmation).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });
  });

  describe('registerC2BUrls', () => {
    it('should call mpesaService.registerC2BUrls', () => {
      const expected = { ResponseDescription: 'Success' };
      mpesaService.registerC2BUrls.mockReturnValue(expected);

      const result = controller.registerC2BUrls();

      expect(mpesaService.registerC2BUrls).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });
});
