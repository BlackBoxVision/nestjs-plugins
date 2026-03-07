import { InAppService } from './in-app.service';
import type { SendNotificationPayload } from '../../interfaces';

describe('InAppService', () => {
  let service: InAppService;
  let mockPrisma: {
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new (InAppService as any)(mockPrisma);
  });

  describe('create', () => {
    it('should set status to delivered and sentAt', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'in_app',
        type: 'message',
        title: 'New Message',
        body: 'You have a new message',
        data: { messageId: '42' },
      };

      await service.create(payload);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          channel: 'in_app',
          type: 'message',
          title: 'New Message',
          body: 'You have a new message',
          data: { messageId: '42' },
          status: 'delivered',
          sentAt: expect.any(Date),
        },
      });
    });

    it('should handle payload without optional data field', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'in_app',
        type: 'alert',
        title: 'Alert',
        body: 'Something happened',
      };

      await service.create(payload);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: undefined,
          status: 'delivered',
        }),
      });
    });
  });

  describe('findAllForUser', () => {
    it('should paginate with default skip/take', async () => {
      const mockData = [{ id: 'notif-1' }, { id: 'notif-2' }];
      mockPrisma.notification.findMany.mockResolvedValue(mockData);
      mockPrisma.notification.count.mockResolvedValue(2);

      const result = await service.findAllForUser('user-1');

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'in_app' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: mockData, total: 2, skip: 0, take: 20 });
    });

    it('should paginate with custom skip/take', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(50);

      const result = await service.findAllForUser('user-1', {
        skip: 10,
        take: 5,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'in_app' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 5,
      });
      expect(result).toEqual({ data: [], total: 50, skip: 10, take: 5 });
    });

    it('should filter by status when provided', async () => {
      await service.findAllForUser('user-1', { status: 'delivered' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', channel: 'in_app', status: 'delivered' },
        }),
      );
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: 'in_app', status: 'delivered' },
      });
    });

    it('should return { data, total, skip, take } structure', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.findAllForUser('user-1');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('skip');
      expect(result).toHaveProperty('take');
    });
  });

  describe('markAsRead', () => {
    it('should update by id, userId, and channel in_app', async () => {
      await service.markAsRead('notif-1', 'user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1', channel: 'in_app' },
        data: { readAt: expect.any(Date), status: 'read' },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for the user', async () => {
      await service.markAllAsRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          channel: 'in_app',
          readAt: null,
        },
        data: { readAt: expect.any(Date), status: 'read' },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should count unread notifications for user', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          channel: 'in_app',
          readAt: null,
        },
      });
    });

    it('should return 0 when no unread notifications exist', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(0);
    });
  });
});
