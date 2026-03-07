import { DeviceTokenService } from './device-token.service';

describe('DeviceTokenService', () => {
  let service: DeviceTokenService;
  let mockPrisma: {
    deviceToken: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      deviceToken: {
        upsert: jest.fn().mockResolvedValue({
          userId: 'user-1',
          token: 'token-abc',
          platform: 'android',
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new (DeviceTokenService as any)(mockPrisma);
  });

  describe('register', () => {
    it('should upsert on userId_token unique constraint', async () => {
      await service.register('user-1', 'token-abc', 'android');

      expect(mockPrisma.deviceToken.upsert).toHaveBeenCalledWith({
        where: { userId_token: { userId: 'user-1', token: 'token-abc' } },
        create: { userId: 'user-1', token: 'token-abc', platform: 'android' },
        update: { platform: 'android', updatedAt: expect.any(Date) },
      });
    });

    it('should handle different platform values', async () => {
      await service.register('user-1', 'token-ios', 'ios');

      expect(mockPrisma.deviceToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { userId: 'user-1', token: 'token-ios', platform: 'ios' },
          update: { platform: 'ios', updatedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('unregister', () => {
    it('should delete by userId and token', async () => {
      await service.unregister('user-1', 'token-abc');

      expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', token: 'token-abc' },
      });
    });
  });

  describe('unregisterAll', () => {
    it('should delete all tokens for user', async () => {
      await service.unregisterAll('user-1');

      expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('findAllForUser', () => {
    it('should return tokens ordered by createdAt desc', async () => {
      const mockTokens = [
        { token: 'token-2', platform: 'ios', createdAt: new Date() },
        { token: 'token-1', platform: 'android', createdAt: new Date() },
      ];
      mockPrisma.deviceToken.findMany.mockResolvedValue(mockTokens);

      const result = await service.findAllForUser('user-1');

      expect(result).toEqual(mockTokens);
      expect(mockPrisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no tokens exist', async () => {
      mockPrisma.deviceToken.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser('user-1');

      expect(result).toEqual([]);
    });
  });
});
