import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenController } from './device-token.controller';
import { DeviceTokenService } from './device-token.service';

describe('DeviceTokenController', () => {
  let controller: DeviceTokenController;
  let mockDeviceTokenService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockDeviceTokenService = {
      register: jest.fn(),
      unregister: jest.fn(),
      unregisterAll: jest.fn(),
      findAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceTokenController],
      providers: [
        {
          provide: DeviceTokenService,
          useValue: mockDeviceTokenService,
        },
      ],
    }).compile();

    controller = module.get<DeviceTokenController>(DeviceTokenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const mockDevice = {
      id: 'dt-1',
      userId: 'user-1',
      token: 'fcm-token-abc',
      platform: 'android',
    };

    it('should extract userId from req.user.id and register device', async () => {
      mockDeviceTokenService.register.mockResolvedValue(mockDevice);
      const req = { user: { id: 'user-1' } };
      const body = { token: 'fcm-token-abc', platform: 'android' };

      const result = await controller.register(req, body);

      expect(result).toEqual(mockDevice);
      expect(mockDeviceTokenService.register).toHaveBeenCalledWith(
        'user-1',
        'fcm-token-abc',
        'android',
      );
    });

    it('should extract userId from req.user.sub', async () => {
      mockDeviceTokenService.register.mockResolvedValue(mockDevice);
      const req = { user: { sub: 'user-sub-1' } };
      const body = { token: 'fcm-token-abc', platform: 'ios' };

      const result = await controller.register(req, body);

      expect(result).toEqual(mockDevice);
      expect(mockDeviceTokenService.register).toHaveBeenCalledWith(
        'user-sub-1',
        'fcm-token-abc',
        'ios',
      );
    });

    it('should prefer req.user.id over req.user.sub', async () => {
      mockDeviceTokenService.register.mockResolvedValue(mockDevice);
      const req = { user: { id: 'user-id', sub: 'user-sub' } };
      const body = { token: 'token-xyz', platform: 'web' };

      await controller.register(req, body);

      expect(mockDeviceTokenService.register).toHaveBeenCalledWith(
        'user-id',
        'token-xyz',
        'web',
      );
    });
  });

  describe('unregister', () => {
    it('should extract userId from req.user.id and unregister device', async () => {
      mockDeviceTokenService.unregister.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } };

      const result = await controller.unregister(req, 'fcm-token-abc');

      expect(result).toEqual({ success: true });
      expect(mockDeviceTokenService.unregister).toHaveBeenCalledWith(
        'user-1',
        'fcm-token-abc',
      );
    });

    it('should extract userId from req.user.sub', async () => {
      mockDeviceTokenService.unregister.mockResolvedValue(undefined);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.unregister(req, 'fcm-token-xyz');

      expect(result).toEqual({ success: true });
      expect(mockDeviceTokenService.unregister).toHaveBeenCalledWith(
        'user-sub-1',
        'fcm-token-xyz',
      );
    });
  });

  describe('unregisterAll', () => {
    it('should extract userId from req.user.id and unregister all devices', async () => {
      mockDeviceTokenService.unregisterAll.mockResolvedValue(undefined);
      const req = { user: { id: 'user-1' } };

      const result = await controller.unregisterAll(req);

      expect(result).toEqual({ success: true });
      expect(mockDeviceTokenService.unregisterAll).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should extract userId from req.user.sub', async () => {
      mockDeviceTokenService.unregisterAll.mockResolvedValue(undefined);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.unregisterAll(req);

      expect(result).toEqual({ success: true });
      expect(mockDeviceTokenService.unregisterAll).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });
  });

  describe('findAll', () => {
    const mockDevices = [
      {
        id: 'dt-1',
        userId: 'user-1',
        token: 'token-1',
        platform: 'android',
      },
      { id: 'dt-2', userId: 'user-1', token: 'token-2', platform: 'ios' },
    ];

    it('should extract userId from req.user.id and return all devices', async () => {
      mockDeviceTokenService.findAllForUser.mockResolvedValue(mockDevices);
      const req = { user: { id: 'user-1' } };

      const result = await controller.findAll(req);

      expect(result).toEqual(mockDevices);
      expect(mockDeviceTokenService.findAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should extract userId from req.user.sub', async () => {
      mockDeviceTokenService.findAllForUser.mockResolvedValue(mockDevices);
      const req = { user: { sub: 'user-sub-1' } };

      const result = await controller.findAll(req);

      expect(result).toEqual(mockDevices);
      expect(mockDeviceTokenService.findAllForUser).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('should return empty array when user has no devices', async () => {
      mockDeviceTokenService.findAllForUser.mockResolvedValue([]);
      const req = { user: { id: 'user-no-devices' } };

      const result = await controller.findAll(req);

      expect(result).toEqual([]);
      expect(mockDeviceTokenService.findAllForUser).toHaveBeenCalledWith(
        'user-no-devices',
      );
    });
  });
});
