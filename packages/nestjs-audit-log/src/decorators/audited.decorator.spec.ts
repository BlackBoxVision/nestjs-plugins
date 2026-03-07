import 'reflect-metadata';
import { of } from 'rxjs';
import { Audited, AuditedInterceptor, AUDIT_ACTION_KEY } from './audited.decorator';
import { auditContextStorage } from '../middleware/prisma-audit.middleware';

describe('Audited decorator', () => {
  it('should return a method decorator function', () => {
    const decorator = Audited();
    expect(typeof decorator).toBe('function');
  });

  it('should set AUDIT_ACTION_KEY metadata when action string is provided', () => {
    class TestController {
      @Audited('custom.action')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      AUDIT_ACTION_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toBe('custom.action');
  });

  it('should set AUDIT_ACTION_KEY metadata to undefined when no action provided', () => {
    class TestController {
      @Audited()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      AUDIT_ACTION_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toBeUndefined();
  });
});

describe('AuditedInterceptor', () => {
  let interceptor: AuditedInterceptor;
  let mockAuditLogService: { log: jest.Mock };
  let mockExecutionContext: any;
  let mockCallHandler: any;
  let mockRequest: any;
  let mockHandler: Function;
  let mockController: Function;

  beforeEach(() => {
    mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    interceptor = new AuditedInterceptor(mockAuditLogService as any);

    mockHandler = function testMethod() {};
    mockController = function TestController() {};

    mockRequest = {
      method: 'POST',
      url: '/api/users',
      params: { entity: 'User', id: '123' },
      query: { include: 'profile' },
      user: { id: 'fallback-user' },
      ip: '10.0.0.1',
      headers: { 'user-agent': 'FallbackAgent/1.0' },
    };

    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue(mockHandler),
      getClass: jest.fn().mockReturnValue(mockController),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ id: 'response-1', data: 'test' })),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should log audit entry after handler executes via tap', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledTimes(1);
      },
      complete: () => {
        done();
      },
    });
  });

  it('should use provided audit action from metadata', (done) => {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, 'users.create', mockHandler);

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'users.create',
          }),
        );
        done();
      },
    });
  });

  it('should fall back to ControllerName.methodName when no action metadata', (done) => {
    Reflect.deleteMetadata(AUDIT_ACTION_KEY, mockHandler);

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'TestController.testMethod',
          }),
        );
        done();
      },
    });
  });

  it('should include request context (method, path, params, query)', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: {
              method: 'POST',
              path: '/api/users',
              params: { entity: 'User', id: '123' },
              query: { include: 'profile' },
            },
          }),
        );
        done();
      },
    });
  });

  it('should use auditContext for userId, ipAddress, userAgent when available', (done) => {
    auditContextStorage.run(
      { userId: 'ctx-user-1', ipAddress: '192.168.1.1', userAgent: 'CtxAgent/1.0' },
      () => {
        const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

        result$.subscribe({
          complete: () => {
            expect(mockAuditLogService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                userId: 'ctx-user-1',
                ipAddress: '192.168.1.1',
                userAgent: 'CtxAgent/1.0',
              }),
            );
            done();
          },
        });
      },
    );
  });

  it('should fall back to request.user.id for userId when no auditContext', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'fallback-user',
          }),
        );
        done();
      },
    });
  });

  it('should fall back to request.user.sub for userId when no id', (done) => {
    mockRequest.user = { sub: 'sub-user-1' };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'sub-user-1',
          }),
        );
        done();
      },
    });
  });

  it('should fall back to request.ip when no auditContext ipAddress', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            ipAddress: '10.0.0.1',
          }),
        );
        done();
      },
    });
  });

  it('should fall back to request user-agent header when no auditContext', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            userAgent: 'FallbackAgent/1.0',
          }),
        );
        done();
      },
    });
  });

  it('should derive entity from request params when available', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: 'User',
          }),
        );
        done();
      },
    });
  });

  it('should derive entity from controller name when no params.entity', (done) => {
    mockRequest.params = { id: '123' };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: 'Test',
          }),
        );
        done();
      },
    });
  });

  it('should use params.id as entityId', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: '123',
          }),
        );
        done();
      },
    });
  });

  it('should use params.entityId when params.id is not present', (done) => {
    mockRequest.params = { entity: 'User', entityId: 'eid-456' };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      complete: () => {
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'eid-456',
          }),
        );
        done();
      },
    });
  });

  it('should call next.handle()', () => {
    interceptor.intercept(mockExecutionContext, mockCallHandler);

    expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
  });

  it('should pass through the response data from the handler', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: (value) => {
        expect(value).toEqual({ id: 'response-1', data: 'test' });
      },
      complete: () => {
        done();
      },
    });
  });
});
