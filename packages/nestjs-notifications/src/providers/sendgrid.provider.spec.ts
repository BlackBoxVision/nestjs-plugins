import * as https from 'https';
import { SendGridEmailProvider } from '../channels/email/providers/sendgrid.provider';
import type { SendGridProviderOptions } from '../interfaces';

jest.mock('https', () => {
  const mockReq = {
    on: jest.fn().mockReturnThis(),
    write: jest.fn(),
    end: jest.fn(),
  };

  return {
    request: jest.fn().mockImplementation((_opts: any, callback: any) => {
      process.nextTick(() => {
        const mockRes = {
          statusCode: 202,
          on: jest.fn().mockImplementation((event: string, handler: any) => {
            if (event === 'data') handler(Buffer.from(''));
            if (event === 'end') handler();
            return mockRes;
          }),
        };
        callback(mockRes);
      });
      return mockReq;
    }),
    __mockReq: mockReq,
  };
});

const mockedHttps = https as jest.Mocked<typeof https> & {
  __mockReq: { on: jest.Mock; write: jest.Mock; end: jest.Mock };
};

describe('SendGridEmailProvider', () => {
  let provider: SendGridEmailProvider;
  const defaultOptions: SendGridProviderOptions = {
    apiKey: 'SG.test-api-key',
    from: 'default@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new SendGridEmailProvider(defaultOptions);

    // Reset to successful response
    (mockedHttps.request as jest.Mock).mockImplementation(
      (_opts: any, callback: any) => {
        process.nextTick(() => {
          const mockRes = {
            statusCode: 202,
            on: jest.fn().mockImplementation((event: string, handler: any) => {
              if (event === 'data') handler(Buffer.from(''));
              if (event === 'end') handler();
              return mockRes;
            }),
          };
          callback(mockRes);
        });
        return mockedHttps.__mockReq;
      },
    );
  });

  it('should format payload correctly with personalizations, from, subject, content', async () => {
    await provider.send({
      to: 'recipient@example.com',
      subject: 'Test Email',
      html: '<p>Hello</p>',
    });

    expect(mockedHttps.request).toHaveBeenCalledTimes(1);

    const writtenPayload = JSON.parse(
      mockedHttps.__mockReq.write.mock.calls[0][0],
    );

    expect(writtenPayload).toEqual({
      personalizations: [{ to: [{ email: 'recipient@example.com' }] }],
      from: { email: 'default@example.com' },
      subject: 'Test Email',
      content: [{ type: 'text/html', value: '<p>Hello</p>' }],
    });
  });

  it('should handle multiple recipients (array)', async () => {
    await provider.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi',
      html: '<p>Multi</p>',
    });

    const writtenPayload = JSON.parse(
      mockedHttps.__mockReq.write.mock.calls[0][0],
    );

    expect(writtenPayload.personalizations[0].to).toEqual([
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ]);
  });

  it('should send with Authorization header', async () => {
    await provider.send({
      to: 'test@example.com',
      subject: 'Auth Test',
      html: '<p>Auth</p>',
    });

    const requestOptions = (mockedHttps.request as jest.Mock).mock.calls[0][0];

    expect(requestOptions.headers.Authorization).toBe(
      'Bearer SG.test-api-key',
    );
    expect(requestOptions.hostname).toBe('api.sendgrid.com');
    expect(requestOptions.path).toBe('/v3/mail/send');
    expect(requestOptions.method).toBe('POST');
  });

  it('should include reply_to when replyTo is provided', async () => {
    await provider.send({
      to: 'test@example.com',
      subject: 'Reply Test',
      html: '<p>Reply</p>',
      replyTo: 'reply@example.com',
    });

    const writtenPayload = JSON.parse(
      mockedHttps.__mockReq.write.mock.calls[0][0],
    );

    expect(writtenPayload.reply_to).toEqual({ email: 'reply@example.com' });
  });

  it('should not include reply_to when replyTo is not provided', async () => {
    await provider.send({
      to: 'test@example.com',
      subject: 'No Reply',
      html: '<p>No reply</p>',
    });

    const writtenPayload = JSON.parse(
      mockedHttps.__mockReq.write.mock.calls[0][0],
    );

    expect(writtenPayload.reply_to).toBeUndefined();
  });

  it('should include text content when provided', async () => {
    await provider.send({
      to: 'test@example.com',
      subject: 'Text Test',
      html: '<p>HTML</p>',
      text: 'Plain text',
    });

    const writtenPayload = JSON.parse(
      mockedHttps.__mockReq.write.mock.calls[0][0],
    );

    expect(writtenPayload.content).toEqual([
      { type: 'text/html', value: '<p>HTML</p>' },
      { type: 'text/plain', value: 'Plain text' },
    ]);
  });

  it('should use custom from address when provided', async () => {
    await provider.send({
      to: 'test@example.com',
      subject: 'Custom From',
      html: '<p>Custom</p>',
      from: 'custom@example.com',
    });

    const writtenPayload = JSON.parse(
      mockedHttps.__mockReq.write.mock.calls[0][0],
    );

    expect(writtenPayload.from).toEqual({ email: 'custom@example.com' });
  });

  it('should reject on non-2xx status', async () => {
    (mockedHttps.request as jest.Mock).mockImplementation(
      (_opts: any, callback: any) => {
        process.nextTick(() => {
          const mockRes = {
            statusCode: 400,
            on: jest.fn().mockImplementation((event: string, handler: any) => {
              if (event === 'data')
                handler(Buffer.from('{"errors":[{"message":"Bad Request"}]}'));
              if (event === 'end') handler();
              return mockRes;
            }),
          };
          callback(mockRes);
        });
        return mockedHttps.__mockReq;
      },
    );

    await expect(
      provider.send({
        to: 'test@example.com',
        subject: 'Fail',
        html: '<p>Fail</p>',
      }),
    ).rejects.toThrow('SendGrid API error (400)');
  });

  it('should reject on network error', async () => {
    const mockReqWithError = {
      on: jest.fn().mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error('Network failure')));
        }
        return mockReqWithError;
      }),
      write: jest.fn(),
      end: jest.fn(),
    };

    (mockedHttps.request as jest.Mock).mockReturnValue(mockReqWithError);

    await expect(
      provider.send({
        to: 'test@example.com',
        subject: 'Network Fail',
        html: '<p>Error</p>',
      }),
    ).rejects.toThrow('Network failure');
  });
});
