import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InAppService } from './in-app.service';
import { NotificationQueryDto } from '../../dto/notification-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class InAppController {
  constructor(private readonly inAppService: InAppService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Req() req: Request & { user: { id: string } },
    @Query() query: NotificationQueryDto,
  ) {
    const userId = req.user.id;

    return this.inAppService.findAllForUser(userId, {
      skip: query.skip,
      take: query.take,
      status: query.status,
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Req() req: Request & { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.inAppService.markAsRead(id, req.user.id);

    return { success: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Req() req: Request & { user: { id: string } }) {
    await this.inAppService.markAllAsRead(req.user.id);

    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@Req() req: Request & { user: { id: string } }) {
    const count = await this.inAppService.getUnreadCount(req.user.id);

    return { count };
  }
}
