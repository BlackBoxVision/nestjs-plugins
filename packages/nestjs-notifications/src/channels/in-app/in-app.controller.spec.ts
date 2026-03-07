import { Test, TestingModule } from '@nestjs/testing';
import { InAppController } from './in-app.controller';
import { InAppService } from './in-app.service';

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
      ],
    }).compile();

    controller = module.get<InAppController>(InAppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    const mockResult = {
      data: [{ id: 'notif-1', title: 'Test' }],
      total: 1,
      skip: 0,
      take: 20,
    };

    it('should extract userId from req.user.id and call findAllForUser', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } };

      const result = await controller.findAll(req);

      expect(result).toEqual(mockResult);
      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: undefined,
        take: undefined,
        status: undefined,
      });
    });

    it('should extract userId from req.user.sub when id is not present', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.findAll(req);

      expect(result).toEqual(mockResult);
      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith(
        'user-sub-1',
        {
          skip: undefined,
          take: undefined,
          status: undefined,
        },
      );
    });

    it('should prefer req.user.id over req.user.sub', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-id', sub: 'user-sub' } };

      await controller.findAll(req);

      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith(
        'user-id',
        expect.any(Object),
      );
    });

    it('should parse skip and take as integers', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } };

      await controller.findAll(req, '10', '25');

      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: 10,
        take: 25,
        status: undefined,
      });
    });

    it('should pass status filter when provided', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } };

      await controller.findAll(req, '0', '20', 'read');

      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: 0,
        take: 20,
        status: 'read',
      });
    });

    it('should leave skip and take undefined when not provided', async () => {
      mockInAppService.findAllForUser.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } };

      await controller.findAll(req, undefined, undefined, undefined);

      expect(mockInAppService.findAllForUser).toHaveBeenCalledWith('user-1', {
        skip: undefined,
        take: undefined,
        status: undefined,
      });
    });
  });

  describe('markAsRead', () => {
    it('should extract userId from req.user.id and call markAsRead', async () => {
      mockInAppService.markAsRead.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } };

      const result = await controller.markAsRead(req, 'notif-42');

      expect(result).toEqual({ success: true });
      expect(mockInAppService.markAsRead).toHaveBeenCalledWith(
        'notif-42',
        'user-1',
      );
    });

    it('should extract userId from req.user.sub', async () => {
      mockInAppService.markAsRead.mockResolvedValue(undefined);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.markAsRead(req, 'notif-99');

      expect(result).toEqual({ success: true });
      expect(mockInAppService.markAsRead).toHaveBeenCalledWith(
        'notif-99',
        'user-sub-1',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should extract userId from req.user.id and call markAllAsRead', async () => {
      mockInAppService.markAllAsRead.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } };

      const result = await controller.markAllAsRead(req);

      expect(result).toEqual({ success: true });
      expect(mockInAppService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });

    it('should extract userId from req.user.sub', async () => {
      mockInAppService.markAllAsRead.mockResolvedValue(undefined);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.markAllAsRead(req);

      expect(result).toEqual({ success: true });
      expect(mockInAppService.markAllAsRead).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should extract userId from req.user.id and return count', async () => {
      mockInAppService.getUnreadCount.mockResolvedValue(5);
      const req = { user: { id: 'user-1' } };

      const result = await controller.getUnreadCount(req);

      expect(result).toEqual({ count: 5 });
      expect(mockInAppService.getUnreadCount).toHaveBeenCalledWith('user-1');
    });

    it('should extract userId from req.user.sub', async () => {
      mockInAppService.getUnreadCount.mockResolvedValue(0);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.getUnreadCount(req);

      expect(result).toEqual({ count: 0 });
      expect(mockInAppService.getUnreadCount).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('should return zero count when no unread notifications', async () => {
      mockInAppService.getUnreadCount.mockResolvedValue(0);
      const req = { user: { id: 'user-1' } };

      const result = await controller.getUnreadCount(req);

      expect(result).toEqual({ count: 0 });
    });
  });
});
