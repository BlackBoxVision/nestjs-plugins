import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DeviceTokenService } from './device-token.service';
import { RegisterDeviceDto } from '../../dto/register-device.dto';

@ApiTags('Device Tokens')
@ApiBearerAuth()
@Controller('notifications/devices')
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post()
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Device token registered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async register(
    @Req() req: Request & { user: { id: string } },
    @Body() body: RegisterDeviceDto,
  ) {
    return this.deviceTokenService.register(
      req.user.id,
      body.token,
      body.platform,
    );
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Unregister a specific device token' })
  @ApiParam({ name: 'token', description: 'Device token to unregister' })
  @ApiResponse({ status: 200, description: 'Device token unregistered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Device token not found' })
  async unregister(
    @Req() req: Request & { user: { id: string } },
    @Param('token') token: string,
  ) {
    await this.deviceTokenService.unregister(req.user.id, token);

    return { success: true };
  }

  @Delete()
  @ApiOperation({ summary: 'Unregister all device tokens for the authenticated user' })
  @ApiResponse({ status: 200, description: 'All device tokens unregistered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unregisterAll(@Req() req: Request & { user: { id: string } }) {
    await this.deviceTokenService.unregisterAll(req.user.id);

    return { success: true };
  }

  @Get()
  @ApiOperation({ summary: 'List all device tokens for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Device tokens retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Req() req: Request & { user: { id: string } }) {
    return this.deviceTokenService.findAllForUser(req.user.id);
  }
}
