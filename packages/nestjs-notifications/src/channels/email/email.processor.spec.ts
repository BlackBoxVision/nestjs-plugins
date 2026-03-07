jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => {},
  WorkerHost: class {},
}));

import { EmailProcessor, EmailJobData } from './email.processor';
import type { EmailProvider, EmailSendOptions } from '../../interfaces';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let mockEmailProvider: jest.Mocked<EmailProvider>;
  let mockPrisma: {
    notification: {
      update: jest.Mock;
    };
  };

  const createJob = (data: EmailJobData) =>
    ({
      id: 'job-1',
      data,
    }) as any;

  const baseJobData: EmailJobData = {
    notificationId: 'notif-1',
    to: 'user@example.com',
    subject: 'Test Subject',
    html: '<p>Hello</p>',
    text: 'Hello',
    from: 'sender@example.com',
    replyTo: 'reply@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockEmailProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      notification: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    processor = new (EmailProcessor as any)(mockEmailProvider, mockPrisma);
  });

  it('should send email via provider and update status to sent', async () => {
    const job = createJob(baseJobData);

    await processor.process(job);

    expect(mockEmailProvider.send).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'sent',
        sentAt: expect.any(Date),
      },
    });
  });

  it('should pass correct EmailSendOptions to provider', async () => {
    const job = createJob(baseJobData);

    await processor.process(job);

    const expectedOptions: EmailSendOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      from: 'sender@example.com',
      replyTo: 'reply@example.com',
    };

    expect(mockEmailProvider.send).toHaveBeenCalledWith(expectedOptions);
  });

  it('should update status to failed on error and rethrow', async () => {
    const error = new Error('SMTP connection failed');
    mockEmailProvider.send.mockRejectedValueOnce(error);

    const job = createJob(baseJobData);

    await expect(processor.process(job)).rejects.toThrow(
      'SMTP connection failed',
    );

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'failed',
        failReason: 'SMTP connection failed',
      },
    });
  });

  it('should handle non-Error thrown objects with Unknown error message', async () => {
    mockEmailProvider.send.mockRejectedValueOnce('string error');

    const job = createJob(baseJobData);

    await expect(processor.process(job)).rejects.toBe('string error');

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: 'failed',
        failReason: 'Unknown error',
      },
    });
  });

  it('should handle optional fields being undefined', async () => {
    const minimalData: EmailJobData = {
      notificationId: 'notif-2',
      to: 'user@example.com',
      subject: 'Minimal',
      html: '<p>Hi</p>',
    };

    const job = createJob(minimalData);
    await processor.process(job);

    expect(mockEmailProvider.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Minimal',
      html: '<p>Hi</p>',
      text: undefined,
      from: undefined,
      replyTo: undefined,
    });
  });
});
