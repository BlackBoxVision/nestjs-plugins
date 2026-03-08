import { Test, TestingModule } from '@nestjs/testing';
import { PreferenceController } from './preference.controller';
import { PreferenceService } from './preference.service';
import { NOTIFICATION_MODULE_OPTIONS } from '../interfaces';

describe('PreferenceController', () => {
  let controller: PreferenceController;
  let mockPreferenceService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockPreferenceService = {
      getPreferences: jest.fn(),
      upsertPreference: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferenceController],
      providers: [
        {
          provide: PreferenceService,
          useValue: mockPreferenceService,
        },
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: { channels: {}, features: { preferences: true } },
        },
      ],
    }).compile();

    controller = module.get<PreferenceController>(PreferenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPreferences', () => {
    const mockPreferences = [
      { id: 'pref-1', userId: 'user-1', channel: 'email', type: 'marketing', enabled: false },
      { id: 'pref-2', userId: 'user-1', channel: 'sms', type: 'alerts', enabled: true },
    ];

    it('should extract userId from req.user.id and return preferences', async () => {
      mockPreferenceService.getPreferences.mockResolvedValue(mockPreferences);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.getPreferences(req);

      expect(result).toEqual(mockPreferences);
      expect(mockPreferenceService.getPreferences).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when user has no preferences', async () => {
      mockPreferenceService.getPreferences.mockResolvedValue([]);
      const req = { user: { id: 'user-1' } } as any;

      const result = await controller.getPreferences(req);

      expect(result).toEqual([]);
    });
  });

  describe('upsertPreference', () => {
    const mockUpsertResult = {
      id: 'pref-1',
      userId: 'user-1',
      channel: 'email',
      type: 'marketing',
      enabled: false,
    };

    it('should extract userId from req.user.id and upsert preference', async () => {
      mockPreferenceService.upsertPreference.mockResolvedValue(mockUpsertResult);
      const req = { user: { id: 'user-1' } } as any;
      const body = { channel: 'email', type: 'marketing', enabled: false };

      const result = await controller.upsertPreference(req, body);

      expect(result).toEqual(mockUpsertResult);
      expect(mockPreferenceService.upsertPreference).toHaveBeenCalledWith(
        'user-1',
        'email',
        'marketing',
        false,
      );
    });

    it('should handle enabling a preference', async () => {
      const enabledResult = { ...mockUpsertResult, enabled: true };
      mockPreferenceService.upsertPreference.mockResolvedValue(enabledResult);
      const req = { user: { id: 'user-1' } } as any;
      const body = { channel: 'push', type: 'promotions', enabled: true };

      const result = await controller.upsertPreference(req, body);

      expect(result).toEqual(enabledResult);
      expect(mockPreferenceService.upsertPreference).toHaveBeenCalledWith(
        'user-1',
        'push',
        'promotions',
        true,
      );
    });
  });
});
