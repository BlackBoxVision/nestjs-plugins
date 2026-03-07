import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createMockHost() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    return {
      host: {
        switchToHttp: jest.fn().mockReturnValue({
          getResponse: jest.fn().mockReturnValue(response),
          getRequest: jest.fn().mockReturnValue({ url: '/test' }),
        }),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as unknown as ArgumentsHost,
      status,
      json,
    };
  }

  it('should handle HttpException with a string message', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        message: 'Not found',
        statusCode: 404,
      }),
    );
  });

  it('should handle HttpException with object response containing message array (validation errors)', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException(
      {
        message: ['email is required', 'password too short'],
        error: 'Bad Request',
        statusCode: 400,
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        message: 'email is required',
        errors: ['email is required', 'password too short'],
        statusCode: 400,
      }),
    );
  });

  it('should handle HttpException with object response containing single message string', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException(
      {
        message: 'Unauthorized access',
        error: 'Unauthorized',
        statusCode: 401,
      },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        message: 'Unauthorized access',
        statusCode: 401,
      }),
    );
    const body = json.mock.calls[0][0];
    expect(body.errors).toBeUndefined();
  });

  it('should handle a generic Error (not HttpException) with 500 status', () => {
    const { host, status, json } = createMockHost();
    const exception = new Error('Something broke');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        message: 'Something broke',
        statusCode: 500,
      }),
    );
  });

  it('should handle a non-Error thrown value with 500 status and default message', () => {
    const { host, status, json } = createMockHost();
    const exception = 'some string thrown';

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: null,
        message: 'Internal server error',
        statusCode: 500,
      }),
    );
  });

  it('should always include success=false, data=null, a valid ISO timestamp, and statusCode', () => {
    const { host, json } = createMockHost();
    const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.statusCode).toBe(400);
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('should handle HttpException with object response where message is an empty array', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException(
      {
        message: [],
        error: 'Bad Request',
        statusCode: 400,
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Validation error');
    expect(body.errors).toEqual([]);
  });
});
