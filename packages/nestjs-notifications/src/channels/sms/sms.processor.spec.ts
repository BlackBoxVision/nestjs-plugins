jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => {},
  WorkerHost: class {},
}));

import { SmsProcessor, SmsJobData } from './sms.processor';
import type { SmsProvider, SmsSendOptions } from '../../interfaces';

describe('SmsProcessor', () => {
  let processor: SmsProcessor;
  let mockSmsProvider: jest.Mocked<SmsProvider>;
  let mockPrisma: {
    notification: {
      update: jest.Mock;
    };
  };

  const createJob = (data: SmsJobData, overrides: Record<string, any> = {}) =>
    ({
      id: 'job-1',
      data,
      attemptsMade: 0,
      opts: { attempts: 1 },
      ...overrides,
    }) as any;

  const baseJobData: SmsJobData = {
    notificationId: 'notif-1',
    to: '+1234567890',
    body: 'Hello via SMS',
    from: '+0987654321',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmsProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      notification: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    processor = new (SmsProcessor as any)(mockSmsProvider, mockPrisma);
  });

  it('should send SMS via provider and update status to sent', async () => {
    const job = createJob(baseJobData);

    await processor.process(job);

    expect(mockSmsProvider.send).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'sent',
        sentAt: expect.any(Date),
      },
    });
  });

  it('should pass correct SmsSendOptions to provider', async () => {
    const job = createJob(baseJobData);

    await processor.process(job);

    const expectedOptions: SmsSendOptions = {
      to: '+1234567890',
      body: 'Hello via SMS',
      from: '+0987654321',
    };

    expect(mockSmsProvider.send).toHaveBeenCalledWith(expectedOptions);
  });

  it('should update status to failed on error and rethrow', async () => {
    const error = new Error('Twilio API error');
    mockSmsProvider.send.mockRejectedValueOnce(error);

    const job = createJob(baseJobData);

    await expect(processor.process(job)).rejects.toThrow('Twilio API error');

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'failed',
        failReason: 'Twilio API error',
      },
    });
  });

  it('should handle non-Error thrown objects with Unknown error message', async () => {
    mockSmsProvider.send.mockRejectedValueOnce(42);

    const job = createJob(baseJobData);

    await expect(processor.process(job)).rejects.toBe(42);

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'failed',
        failReason: 'Unknown error',
      },
    });
  });

  it('should handle job data without optional from field', async () => {
    const minimalData: SmsJobData = {
      notificationId: 'notif-2',
      to: '+1234567890',
      body: 'No from field',
    };

    const job = createJob(minimalData);
    await processor.process(job);

    expect(mockSmsProvider.send).toHaveBeenCalledWith({
      to: '+1234567890',
      body: 'No from field',
      from: undefined,
    });
  });
});
