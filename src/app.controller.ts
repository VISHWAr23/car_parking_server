import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Public health check endpoint' })
  getHealth() {
    return {
      status: 'ok',
      service: 'parking-management-api',
      timestamp: new Date().toISOString(),
    };
  }
}
