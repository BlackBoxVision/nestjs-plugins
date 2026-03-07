import {
  createAuditMiddleware,
  auditContextStorage,
} from './prisma-audit.middleware';
import { AuditLogModuleOptions } from '../interfaces';

describe('createAuditMiddleware', () => {
  let mockAuditLogService: { log: jest.Mock };
  let options: AuditLogModuleOptions;
  let middleware: (params: any, next: (params: any) => Promise<any>) => Promise<any>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    options = {
      features: { trackChanges: true },
      excludeEntities: ['AuditLog'],
      excludeFields: ['password', 'hash'],
    };

    middleware = createAuditMiddleware(mockAuditLogService as any, options);
    mockNext = jest.fn().mockResolvedValue({ id: 'result-1', name: 'Test' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('pass-through scenarios', () => {
    it('should pass through when model is undefined', async () => {
      const params = { model: undefined, action: 'create', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should pass through for non-tracked actions (findMany)', async () => {
      const params = { model: 'User', action: 'findMany', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should pass through for non-tracked actions (count)', async () => {
      const params = { model: 'User', action: 'count', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should pass through for non-tracked actions (findFirst)', async () => {
      const params = { model: 'User', action: 'findFirst', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should pass through for non-tracked actions (findUnique)', async () => {
      const params = { model: 'User', action: 'findUnique', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should pass through for excluded entities (case-insensitive)', async () => {
      const params = { model: 'AuditLog', action: 'create', args: { data: {} } };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should ignore excluded entities regardless of case', async () => {
      const params = { model: 'auditlog', action: 'create', args: { data: {} } };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should ignore excluded entities with mixed case', async () => {
      const params = { model: 'AUDITLOG', action: 'create', args: { data: {} } };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });
  });

  describe('CREATE action', () => {
    it('should log a CREATE action with entity data', async () => {
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { name: 'John', email: 'john@test.com' } },
      };

      await auditContextStorage.run(
        { userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'CREATE',
        entity: 'User',
        entityId: 'result-1',
        metadata: { name: 'John', email: 'john@test.com' },
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      });
    });

    it('should sanitize excluded fields in CREATE metadata', async () => {
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { name: 'John', password: 'secret123', hash: 'abc123' } },
      };

      await auditContextStorage.run(
        { userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            name: 'John',
            password: '[REDACTED]',
            hash: '[REDACTED]',
          },
        }),
      );
    });

    it('should preserve non-excluded fields in CREATE metadata', async () => {
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { name: 'John', email: 'john@test.com', role: 'admin' } },
      };

      await auditContextStorage.run(
        { userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      const logCall = mockAuditLogService.log.mock.calls[0][0];
      expect(logCall.metadata).toEqual({
        name: 'John',
        email: 'john@test.com',
        role: 'admin',
      });
    });

    it('should use result id as entityId', async () => {
      mockNext.mockResolvedValue({ id: 42, name: 'Created' });

      const params = {
        model: 'Post',
        action: 'create',
        args: { data: { title: 'Hello' } },
      };

      await auditContextStorage.run(
        { userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: '42',
        }),
      );
    });

    it('should return the result from next()', async () => {
      const expectedResult = { id: 'result-1', name: 'Test' };
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { name: 'John' } },
      };

      const result = await auditContextStorage.run(
        { userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          return middleware(params, mockNext);
        },
      );

      expect(result).toEqual(expectedResult);
    });

    it('should handle CREATE without audit context', async () => {
      const params = {
        model: 'User',
        action: 'create',
        args: { data: { name: 'John' } },
      };

      await middleware(params, mockNext);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        }),
      );
    });
  });

  describe('UPDATE action', () => {
    it('should log an UPDATE action with changes when trackChanges is enabled', async () => {
      const params = {
        model: 'User',
        action: 'update',
        args: {
          where: { id: 'user-1' },
          data: { name: 'Jane', email: 'jane@test.com' },
        },
      };

      mockNext.mockResolvedValue({ id: 'user-1', name: 'Jane', email: 'jane@test.com' });

      await auditContextStorage.run(
        { userId: 'admin-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entity: 'User',
          entityId: 'user-1',
          changes: {
            name: { old: null, new: 'Jane' },
            email: { old: null, new: 'jane@test.com' },
          },
        }),
      );
    });

    it('should skip excluded fields from changes', async () => {
      const params = {
        model: 'User',
        action: 'update',
        args: {
          where: { id: 'user-1' },
          data: { name: 'Jane', password: 'newpassword' },
        },
      };

      mockNext.mockResolvedValue({ id: 'user-1', name: 'Jane' });

      await auditContextStorage.run(
        { userId: 'admin-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      const logCall = mockAuditLogService.log.mock.calls[0][0];
      expect(logCall.changes).toBeDefined();
      expect(logCall.changes).toHaveProperty('name');
      expect(logCall.changes).not.toHaveProperty('password');
    });

    it('should set changes to undefined when all fields are excluded', async () => {
      const params = {
        model: 'User',
        action: 'update',
        args: {
          where: { id: 'user-1' },
          data: { password: 'newpassword', hash: 'newhash' },
        },
      };

      mockNext.mockResolvedValue({ id: 'user-1' });

      await auditContextStorage.run(
        { userId: 'admin-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: undefined,
        }),
      );
    });

    it('should include context in UPDATE log', async () => {
      const params = {
        model: 'User',
        action: 'update',
        args: { where: { id: 'user-1' }, data: { name: 'Jane' } },
      };

      mockNext.mockResolvedValue({ id: 'user-1', name: 'Jane' });

      await auditContextStorage.run(
        { userId: 'admin-1', ipAddress: '10.0.0.1', userAgent: 'AdminPanel/2.0' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          ipAddress: '10.0.0.1',
          userAgent: 'AdminPanel/2.0',
        }),
      );
    });
  });

  describe('DELETE action', () => {
    it('should log a DELETE action with result data', async () => {
      const deletedRecord = { id: 'user-99', name: 'Deleted User', email: 'del@test.com' };
      mockNext.mockResolvedValue(deletedRecord);

      const params = {
        model: 'User',
        action: 'delete',
        args: { where: { id: 'user-99' } },
      };

      await auditContextStorage.run(
        { userId: 'admin-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          entity: 'User',
          entityId: 'user-99',
          metadata: {
            id: 'user-99',
            name: 'Deleted User',
            email: 'del@test.com',
          },
        }),
      );
    });

    it('should sanitize excluded fields in DELETE metadata', async () => {
      const deletedRecord = {
        id: 'user-99',
        name: 'Deleted',
        password: 'shouldberedacted',
        hash: 'shouldberedacted',
      };
      mockNext.mockResolvedValue(deletedRecord);

      const params = {
        model: 'User',
        action: 'delete',
        args: { where: { id: 'user-99' } },
      };

      await auditContextStorage.run(
        { userId: 'admin-1', ipAddress: '1.2.3.4', userAgent: 'test' },
        async () => {
          await middleware(params, mockNext);
        },
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            id: 'user-99',
            name: 'Deleted',
            password: '[REDACTED]',
            hash: '[REDACTED]',
          },
        }),
      );
    });

    it('should return the result from next() after DELETE', async () => {
      const deletedRecord = { id: 'user-99', name: 'Deleted' };
      mockNext.mockResolvedValue(deletedRecord);

      const params = {
        model: 'User',
        action: 'delete',
        args: { where: { id: 'user-99' } },
      };

      const result = await middleware(params, mockNext);

      expect(result).toEqual(deletedRecord);
    });
  });

  describe('default excludeFields', () => {
    it('should use default excluded fields when none specified', async () => {
      const defaultMiddleware = createAuditMiddleware(mockAuditLogService as any, {});

      const params = {
        model: 'User',
        action: 'create',
        args: {
          data: {
            name: 'John',
            password: 'pw',
            hash: 'h',
            token: 't',
            secret: 's',
            email: 'j@test.com',
          },
        },
      };

      await defaultMiddleware(params, mockNext);

      const logCall = mockAuditLogService.log.mock.calls[0][0];
      expect(logCall.metadata.password).toBe('[REDACTED]');
      expect(logCall.metadata.hash).toBe('[REDACTED]');
      expect(logCall.metadata.token).toBe('[REDACTED]');
      expect(logCall.metadata.secret).toBe('[REDACTED]');
      expect(logCall.metadata.name).toBe('John');
      expect(logCall.metadata.email).toBe('j@test.com');
    });
  });

  describe('error handling', () => {
    it('should not block when auditLogService.log fails on CREATE', async () => {
      mockAuditLogService.log.mockRejectedValue(new Error('DB write failed'));

      const params = {
        model: 'User',
        action: 'create',
        args: { data: { name: 'John' } },
      };

      await expect(middleware(params, mockNext)).rejects.toThrow('DB write failed');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not block when auditLogService.log fails on DELETE', async () => {
      mockAuditLogService.log.mockRejectedValue(new Error('DB write failed'));
      mockNext.mockResolvedValue({ id: 'user-1', name: 'Test' });

      const params = {
        model: 'User',
        action: 'delete',
        args: { where: { id: 'user-1' } },
      };

      await expect(middleware(params, mockNext)).rejects.toThrow('DB write failed');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('next() invocation', () => {
    it('should always call next() for tracked create actions', async () => {
      const params = { model: 'User', action: 'create', args: { data: {} } };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
    });

    it('should always call next() for tracked update actions', async () => {
      const params = {
        model: 'User',
        action: 'update',
        args: { where: { id: '1' }, data: { name: 'New' } },
      };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
    });

    it('should always call next() for tracked delete actions', async () => {
      const params = { model: 'User', action: 'delete', args: { where: { id: '1' } } };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
    });

    it('should always call next() for non-tracked actions', async () => {
      const params = { model: 'User', action: 'findMany', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
    });

    it('should always call next() for excluded entities', async () => {
      const params = { model: 'AuditLog', action: 'create', args: { data: {} } };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
    });

    it('should always call next() when model is undefined', async () => {
      const params = { model: undefined, action: 'create', args: {} };

      await middleware(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
    });
  });

  describe('sanitizeData edge cases', () => {
    it('should handle undefined args.data for CREATE', async () => {
      const params = {
        model: 'User',
        action: 'create',
        args: {},
      };

      await middleware(params, mockNext);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: undefined,
        }),
      );
    });

    it('should handle null args.data for CREATE', async () => {
      const params = {
        model: 'User',
        action: 'create',
        args: { data: null },
      };

      await middleware(params, mockNext);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: undefined,
        }),
      );
    });
  });
});
