import { PreferenceService } from './preference.service';

describe('PreferenceService', () => {
  let service: PreferenceService;
  let mockPrisma: {
    notificationPreference: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    service = new (PreferenceService as any)(mockPrisma);
  });

  describe('getPreferences', () => {
    it('should return all preferences for user', async () => {
      const mockPreferences = [
        { userId: 'user-1', channel: 'email', type: 'marketing', enabled: true },
        { userId: 'user-1', channel: 'sms', type: 'marketing', enabled: false },
      ];
      mockPrisma.notificationPreference.findMany.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getPreferences('user-1');

      expect(result).toEqual(mockPreferences);
      expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should return empty array when no preferences exist', async () => {
      const result = await service.getPreferences('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('upsertPreference', () => {
    it('should upsert preference record with userId_channel_type', async () => {
      const mockResult = {
        userId: 'user-1',
        channel: 'email',
        type: 'marketing',
        enabled: false,
      };
      mockPrisma.notificationPreference.upsert.mockResolvedValue(mockResult);

      const result = await service.upsertPreference(
        'user-1',
        'email',
        'marketing',
        false,
      );

      expect(result).toEqual(mockResult);
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: {
          userId_channel_type: {
            userId: 'user-1',
            channel: 'email',
            type: 'marketing',
          },
        },
        update: { enabled: false },
        create: {
          userId: 'user-1',
          channel: 'email',
          type: 'marketing',
          enabled: false,
        },
      });
    });
  });

  describe('isEnabled', () => {
    it('should return true when preference is enabled', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        enabled: true,
      });

      const result = await service.isEnabled('user-1', 'email', 'marketing');

      expect(result).toBe(true);
      expect(
        mockPrisma.notificationPreference.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          userId_channel_type: {
            userId: 'user-1',
            channel: 'email',
            type: 'marketing',
          },
        },
      });
    });

    it('should return false when preference is disabled', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        enabled: false,
      });

      const result = await service.isEnabled('user-1', 'sms', 'alerts');

      expect(result).toBe(false);
    });

    it('should return true (default) when no preference exists', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.isEnabled('user-1', 'push', 'updates');

      expect(result).toBe(true);
    });

    it('should return true when preference exists but enabled is undefined', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({});

      const result = await service.isEnabled('user-1', 'email', 'digest');

      // undefined ?? true => true
      expect(result).toBe(true);
    });
  });
});
