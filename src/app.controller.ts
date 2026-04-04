import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  health() {
    return {
      status: 'ok',
      name: 'ERP Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      modules: [
        'auth',
        'accounting',
        'sales',
        'inventory',
        'procurement',
        'hr',
        'etims',
        'tax',
        'settings',
        'notifications',
      ],
    };
  }
}
