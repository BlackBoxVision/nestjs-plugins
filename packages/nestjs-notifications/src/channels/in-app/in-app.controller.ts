import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { InAppService } from './in-app.service';

@Controller('notifications')
export class InAppController {
  constructor(private readonly inAppService: InAppService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user?.id ?? req.user?.sub;

    return this.inAppService.findAllForUser(userId, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      status,
    });
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id ?? req.user?.sub;

    await this.inAppService.markAsRead(id, userId);

    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;

    await this.inAppService.markAllAsRead(userId);

    return { success: true };
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;

    const count = await this.inAppService.getUnreadCount(userId);

    return { count };
  }
}
