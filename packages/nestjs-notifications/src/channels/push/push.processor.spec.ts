jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => {},
  WorkerHost: class {},
}));

import { PushProcessor, PushJobData } from './push.processor';
import type { PushProvider, PushSendOptions } from '../../interfaces';

describe('PushProcessor', () => {
  let processor: PushProcessor;
  let mockPushProvider: jest.Mocked<PushProvider>;
  let mockPrisma: {
    notification: {
      update: jest.Mock;
    };
  };

  const createJob = (data: PushJobData) =>
    ({
      id: 'job-1',
      data,
    }) as any;

  const baseJobData: PushJobData = {
    notificationId: 'notif-1',
    token: 'device-token-abc',
    title: 'New Message',
    body: 'You have a new message',
    data: { messageId: '123' },
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } },
    webpush: { headers: { Urgency: 'high' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPushProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      notification: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    processor = new (PushProcessor as any)(mockPushProvider, mockPrisma);
  });

  it('should send push notification via provider and update status to sent', async () => {
    const job = createJob(baseJobData);

    await processor.process(job);

    expect(mockPushProvider.send).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'sent',
        sentAt: expect.any(Date),
      },
    });
  });

  it('should pass platform-specific options (android, apns, webpush) to provider', async () => {
    const job = createJob(baseJobData);

    await processor.process(job);

    const expectedOptions: PushSendOptions = {
      token: 'device-token-abc',
      title: 'New Message',
      body: 'You have a new message',
      data: { messageId: '123' },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
      webpush: { headers: { Urgency: 'high' } },
    };

    expect(mockPushProvider.send).toHaveBeenCalledWith(expectedOptions);
  });

  it('should update status to failed on error and rethrow', async () => {
    const error = new Error('Firebase messaging error');
    mockPushProvider.send.mockRejectedValueOnce(error);

    const job = createJob(baseJobData);

    await expect(processor.process(job)).rejects.toThrow(
      'Firebase messaging error',
    );

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'failed',
        failReason: 'Firebase messaging error',
      },
    });
  });

  it('should handle non-Error thrown objects with Unknown error message', async () => {
    mockPushProvider.send.mockRejectedValueOnce({ code: 'INVALID_TOKEN' });

    const job = createJob(baseJobData);

    await expect(processor.process(job)).rejects.toEqual({
      code: 'INVALID_TOKEN',
    });

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'failed',
        failReason: 'Unknown error',
      },
    });
  });

  it('should handle job without optional fields', async () => {
    const minimalData: PushJobData = {
      notificationId: 'notif-2',
      token: 'device-token-xyz',
      title: 'Simple Push',
      body: 'No extras',
    };

    const job = createJob(minimalData);
    await processor.process(job);

    expect(mockPushProvider.send).toHaveBeenCalledWith({
      token: 'device-token-xyz',
      title: 'Simple Push',
      body: 'No extras',
      data: undefined,
      android: undefined,
      apns: undefined,
      webpush: undefined,
    });

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-2' },
      data: {
        status: 'sent',
        sentAt: expect.any(Date),
      },
    });
  });
});
