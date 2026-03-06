import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationService } from './notification.service';
import { InAppService } from './channels/in-app/in-app.service';
import { PreferenceService } from './preferences/preference.service';
import {
  NOTIFICATION_MODULE_OPTIONS,
  type NotificationModuleOptions,
  type SendNotificationPayload,
} from './interfaces';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockPrisma: any;
  let mockEmailQueue: any;
  let mockSmsQueue: any;
  let mockInAppService: jest.Mocked<InAppService>;
  let mockPreferenceService: jest.Mocked<PreferenceService>;

  const defaultOptions: NotificationModuleOptions = {
    channels: {
      email: {
        enabled: true,
        provider: 'smtp',
        providerOptions: {
          host: 'localhost',
          port: 587,
          from: 'test@example.com',
        },
      },
      inApp: { enabled: true },
      sms: {
        enabled: true,
        provider: 'twilio',
        providerOptions: {
          accountSid: 'AC123',
          authToken: 'token',
          from: '+1234567890',
        },
      },
    },
    features: {
      preferences: true,
    },
    queue: {
      redis: { host: 'localhost' },
    },
  };

  beforeEach(async () => {
    mockPrisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockEmailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-email-1' }),
    };

    mockSmsQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-sms-1' }),
    };

    mockInAppService = {
      create: jest.fn().mockResolvedValue({ id: 'inapp-1' }),
      findAllForUser: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
    } as any;

    mockPreferenceService = {
      isEnabled: jest.fn().mockResolvedValue(true),
      getPreferences: jest.fn(),
      upsertPreference: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: defaultOptions,
        },
        {
          provide: 'PRISMA_SERVICE',
          useValue: mockPrisma,
        },
        {
          provide: getQueueToken('notifications-email'),
          useValue: mockEmailQueue,
        },
        {
          provide: getQueueToken('notifications-sms'),
          useValue: mockSmsQueue,
        },
        {
          provide: InAppService,
          useValue: mockInAppService,
        },
        {
          provide: PreferenceService,
          useValue: mockPreferenceService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('should create a notification record in the database', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'email',
        type: 'welcome',
        title: 'Welcome',
        body: '<p>Hello</p>',
        to: 'user@example.com',
      };

      await service.send(payload);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          channel: 'email',
          type: 'welcome',
          title: 'Welcome',
          body: '<p>Hello</p>',
          data: undefined,
          status: 'pending',
        },
      });
    });

    it('should route email notifications to the email queue', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'email',
        type: 'welcome',
        title: 'Welcome',
        body: '<p>Hello</p>',
        to: 'user@example.com',
      };

      const result = await service.send(payload);

      expect(result).toEqual({ id: 'notif-1' });
      expect(mockEmailQueue.add).toHaveBeenCalledWith('send', {
        notificationId: 'notif-1',
        to: 'user@example.com',
        subject: 'Welcome',
        html: '<p>Hello</p>',
      });
    });

    it('should route in-app notifications to InAppService', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'in_app',
        type: 'info',
        title: 'New message',
        body: 'You have a new message',
      };

      const result = await service.send(payload);

      expect(result).toEqual({ id: 'notif-1' });
      expect(mockInAppService.create).toHaveBeenCalledWith(payload);
    });

    it('should route SMS notifications to the SMS queue', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'sms',
        type: 'verification',
        title: 'Verify',
        body: 'Your code is 123456',
        to: '+1987654321',
      };

      const result = await service.send(payload);

      expect(result).toEqual({ id: 'notif-1' });
      expect(mockSmsQueue.add).toHaveBeenCalledWith('send', {
        notificationId: 'notif-1',
        to: '+1987654321',
        body: 'Your code is 123456',
      });
    });

    it('should check user preferences before sending', async () => {
      mockPreferenceService.isEnabled.mockResolvedValue(false);

      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'email',
        type: 'marketing',
        title: 'Promo',
        body: 'Sale!',
        to: 'user@example.com',
      };

      const result = await service.send(payload);

      expect(result).toEqual({ id: '' });
      expect(mockPreferenceService.isEnabled).toHaveBeenCalledWith(
        'user-1',
        'email',
        'marketing',
      );
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('should persist data field when provided', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'in_app',
        type: 'alert',
        title: 'Alert',
        body: 'Something happened',
        data: { claimId: 'claim-123' },
      };

      await service.send(payload);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: { claimId: 'claim-123' },
        }),
      });
    });

    it('should not call email queue when email channel is disabled', async () => {
      // Re-create service with email disabled
      const disabledOptions: NotificationModuleOptions = {
        ...defaultOptions,
        channels: {
          ...defaultOptions.channels,
          email: { enabled: false },
        },
      };

      const module = await Test.createTestingModule({
        providers: [
          NotificationService,
          { provide: NOTIFICATION_MODULE_OPTIONS, useValue: disabledOptions },
          { provide: 'PRISMA_SERVICE', useValue: mockPrisma },
          { provide: getQueueToken('notifications-email'), useValue: mockEmailQueue },
          { provide: getQueueToken('notifications-sms'), useValue: mockSmsQueue },
          { provide: InAppService, useValue: mockInAppService },
          { provide: PreferenceService, useValue: mockPreferenceService },
        ],
      }).compile();

      const svc = module.get<NotificationService>(NotificationService);

      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'email',
        type: 'welcome',
        title: 'Welcome',
        body: '<p>Hi</p>',
        to: 'user@example.com',
      };

      await svc.send(payload);

      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('should not call SMS queue when no recipient is provided', async () => {
      const payload: SendNotificationPayload = {
        userId: 'user-1',
        channel: 'sms',
        type: 'alert',
        title: 'Alert',
        body: 'Alert text',
        // no "to" field
      };

      await service.send(payload);

      expect(mockSmsQueue.add).not.toHaveBeenCalled();
    });
  });
});
