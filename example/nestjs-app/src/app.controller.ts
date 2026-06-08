import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  index(): { message: string; docs: string } {
    return {
      message: 'super-http NestJS example API',
      docs:    'https://superhttp.dev/guide/nestjs',
    };
  }
}
