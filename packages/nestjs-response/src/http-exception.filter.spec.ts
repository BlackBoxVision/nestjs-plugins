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
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      errors: { _general: ['Not found'] },
    });
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
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.errors).toBeDefined();
    // "email is required" parses as field=email, message="is required"
    expect(body.errors.email).toEqual(['is required']);
    // "password too short" parses as field=password, message="too short"
    expect(body.errors.password).toEqual(['too short']);
  });

  it('should parse field-prefixed validation messages into field map', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException(
      {
        message: ['email must be a valid email', 'name must not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.errors.email).toEqual(['must be a valid email']);
    expect(body.errors.name).toEqual(['must not be empty']);
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
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      errors: { _general: ['Unauthorized access'] },
    });
  });

  it('should handle a generic Error (not HttpException) with 500 status', () => {
    const { host, status, json } = createMockHost();
    const exception = new Error('Something broke');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      errors: { _general: ['Something broke'] },
    });
  });

  it('should handle a non-Error thrown value with 500 status and default message', () => {
    const { host, status, json } = createMockHost();
    const exception = 'some string thrown';

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      errors: { _general: ['Internal server error'] },
    });
  });

  it('should always include success=false and data=null', () => {
    const { host, json } = createMockHost();
    const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.errors).toBeDefined();
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
    expect(body.errors._general).toEqual(['Validation error']);
  });
});
