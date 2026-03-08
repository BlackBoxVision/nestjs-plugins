import { Test, TestingModule } from '@nestjs/testing';
import { InAppController } from './in-app.controller';
import { InAppService } from './in-app.service';
import { NotificationQueryDto } from '../../dto/notification-query.dto';
import { NOTIFICATION_MODULE_OPTIONS } from '../../interfaces';

describe('InAppController', () => {
  let controller: InAppController;
  let mockInAppService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockInAppService = {
      findAllForUser: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InAppController],
      providers: [
        {
          provide: InAppService,
          useValue: mockInAppService,
        },
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: { channels: { inApp: { enabled: true } }, features: {} },
        },
      ],
    }).compile();

    controller = module.get<InAppController>(InAppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  function createQuery(overrides: Partial<NotificationQueryDto> = {}): NotificationQueryDto {
    const query = new NotificationQueryDto();
    Object.assign(query, overrides);
    return query;
  }

  describe('findAll', () => {
    const mockResult = {
      data: [{ id: 'notif-1', title: 'Test' }],
      total: 1,
      skip: 0,
      take: 20,
    };

    it('should extract userId from req.user.id and call findAllForUser', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.findAll(req, createQuery());

      expect(result).toEqual(mockResult);
      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: 0,
        take: 10,
        status: undefined,
      });
    });

    it('should pass status filter when provided', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } } as any;

      await controller.findAll(req, createQuery({ status: 'read' }));

      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: 0,
        take: 10,
        status: 'read',
      });
    });

    it('should pass pagination params from query', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } } as any;

      await controller.findAll(req, createQuery({ page: 2, limit: 25 }));

      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: 50,
        take: 25,
        status: undefined,
      });
    });
  });

  describe('markAsRead', () => {
    it('should extract userId from req.user.id and call markAsRead', async () => {
      mockInAppService.markAsRead.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.markAsRead(req, 'notif-42');

      expect(result).toEqual({ success: true });
      expect(mockInAppService.markAsRead).toHaveBeenCalledWith(
        'notif-42',
        'user-1',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should extract userId from req.user.id and call markAllAsRead', async () => {
      mockInAppService.markAllAsRead.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.markAllAsRead(req);

      expect(result).toEqual({ success: true });
      expect(mockInAppService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getUnreadCount', () => {
    it('should extract userId from req.user.id and return count', async () => {
      mockInAppService.getUnreadCount.mockResolvedValue(5);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.getUnreadCount(req);

      expect(result).toEqual({ count: 5 });
      expect(mockInAppService.getUnreadCount).toHaveBeenCalledWith('user-1');
    });

    it('should return zero count when no unread notifications', async () => {
      mockInAppService.getUnreadCount.mockResolvedValue(0);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.getUnreadCount(req);

      expect(result).toEqual({ count: 0 });
    });
  });
});
