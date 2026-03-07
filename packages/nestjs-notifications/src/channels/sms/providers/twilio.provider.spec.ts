import * as https from 'https';
import { TwilioSmsProvider } from './twilio.provider';

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
          statusCode: 201,
          on: jest.fn().mockImplementation((event: string, handler: any) => {
            if (event === 'data') handler(Buffer.from('{"sid":"SM123"}'));
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

describe('TwilioSmsProvider', () => {
  let provider: TwilioSmsProvider;
  const defaultOptions = {
    accountSid: 'AC_test_account_sid',
    authToken: 'test_auth_token',
    from: '+15551234567',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new TwilioSmsProvider(defaultOptions);

    (mockedHttps.request as jest.Mock).mockImplementation(
      (_opts: any, callback: any) => {
        process.nextTick(() => {
          const mockRes = {
            statusCode: 201,
            on: jest.fn().mockImplementation((event: string, handler: any) => {
              if (event === 'data') handler(Buffer.from('{"sid":"SM123"}'));
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

  it('should send SMS successfully with status 201', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Hello from tests',
    });

    expect(mockedHttps.request).toHaveBeenCalledTimes(1);
    expect(mockedHttps.__mockReq.write).toHaveBeenCalledTimes(1);
    expect(mockedHttps.__mockReq.end).toHaveBeenCalledTimes(1);
  });

  it('should use custom from when provided in send options', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Custom from',
      from: '+15550001111',
    });

    const payload = mockedHttps.__mockReq.write.mock.calls[0][0];
    const params = new URLSearchParams(payload);

    expect(params.get('From')).toBe('+15550001111');
  });

  it('should use default from when not provided in send options', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Default from',
    });

    const payload = mockedHttps.__mockReq.write.mock.calls[0][0];
    const params = new URLSearchParams(payload);

    expect(params.get('From')).toBe('+15551234567');
  });

  it('should send correct To and Body in URL-encoded payload', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Test message body',
    });

    const payload = mockedHttps.__mockReq.write.mock.calls[0][0];
    const params = new URLSearchParams(payload);

    expect(params.get('To')).toBe('+15559876543');
    expect(params.get('Body')).toBe('Test message body');
  });

  it('should reject on non-2xx status code', async () => {
    (mockedHttps.request as jest.Mock).mockImplementation(
      (_opts: any, callback: any) => {
        process.nextTick(() => {
          const mockRes = {
            statusCode: 400,
            on: jest.fn().mockImplementation((event: string, handler: any) => {
              if (event === 'data')
                handler(Buffer.from('{"message":"Invalid To number"}'));
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
        to: 'invalid',
        body: 'Fail',
      }),
    ).rejects.toThrow('Twilio API error (400)');
  });

  it('should reject on request error', async () => {
    const mockReqWithError = {
      on: jest.fn().mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error('Connection refused')));
        }
        return mockReqWithError;
      }),
      write: jest.fn(),
      end: jest.fn(),
    };

    (mockedHttps.request as jest.Mock).mockReturnValue(mockReqWithError);

    await expect(
      provider.send({
        to: '+15559876543',
        body: 'Error test',
      }),
    ).rejects.toThrow('Connection refused');
  });

  it('should send correct Basic auth header with base64-encoded credentials', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Auth test',
    });

    const requestOptions = (mockedHttps.request as jest.Mock).mock.calls[0][0];
    const expectedCredentials = Buffer.from(
      `${defaultOptions.accountSid}:${defaultOptions.authToken}`,
    ).toString('base64');

    expect(requestOptions.headers.Authorization).toBe(
      `Basic ${expectedCredentials}`,
    );
  });

  it('should send correct Content-Type and Content-Length headers', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Headers test',
    });

    const requestOptions = (mockedHttps.request as jest.Mock).mock.calls[0][0];

    expect(requestOptions.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(typeof requestOptions.headers['Content-Length']).toBe('number');
    expect(requestOptions.headers['Content-Length']).toBeGreaterThan(0);
  });

  it('should POST to the correct Twilio API endpoint', async () => {
    await provider.send({
      to: '+15559876543',
      body: 'Endpoint test',
    });

    const requestOptions = (mockedHttps.request as jest.Mock).mock.calls[0][0];

    expect(requestOptions.hostname).toBe('api.twilio.com');
    expect(requestOptions.path).toBe(
      `/2010-04-01/Accounts/${defaultOptions.accountSid}/Messages.json`,
    );
    expect(requestOptions.method).toBe('POST');
  });

  it('should resolve on status 200', async () => {
    (mockedHttps.request as jest.Mock).mockImplementation(
      (_opts: any, callback: any) => {
        process.nextTick(() => {
          const mockRes = {
            statusCode: 200,
            on: jest.fn().mockImplementation((event: string, handler: any) => {
              if (event === 'data') handler(Buffer.from('{}'));
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
      provider.send({ to: '+15559876543', body: 'OK' }),
    ).resolves.toBeUndefined();
  });

  it('should include error response data in rejection message', async () => {
    (mockedHttps.request as jest.Mock).mockImplementation(
      (_opts: any, callback: any) => {
        process.nextTick(() => {
          const mockRes = {
            statusCode: 401,
            on: jest.fn().mockImplementation((event: string, handler: any) => {
              if (event === 'data')
                handler(Buffer.from('Unauthorized'));
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
      provider.send({ to: '+15559876543', body: 'Unauthorized test' }),
    ).rejects.toThrow('Twilio API error (401): Unauthorized');
  });
});
