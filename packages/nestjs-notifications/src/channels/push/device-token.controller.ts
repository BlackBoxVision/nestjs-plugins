import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { DeviceTokenService } from './device-token.service';

@Controller('notifications/devices')
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post()
  async register(
    @Req() req: any,
    @Body() body: { token: string; platform: string },
  ) {
    const userId = req.user?.id ?? req.user?.sub;

    const device = await this.deviceTokenService.register(
      userId,
      body.token,
      body.platform,
    );

    return device;
  }

  @Delete(':token')
  async unregister(@Req() req: any, @Param('token') token: string) {
    const userId = req.user?.id ?? req.user?.sub;

    await this.deviceTokenService.unregister(userId, token);

    return { success: true };
  }

  @Delete()
  async unregisterAll(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;

    await this.deviceTokenService.unregisterAll(userId);

    return { success: true };
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;

    return this.deviceTokenService.findAllForUser(userId);
  }
}
