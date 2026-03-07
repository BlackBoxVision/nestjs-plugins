import {
  AuditContextMiddleware,
  auditContextStorage,
  AuditContext,
} from './prisma-audit.middleware';

describe('AuditContextMiddleware', () => {
  let middleware: AuditContextMiddleware;

  beforeEach(() => {
    middleware = new AuditContextMiddleware();
  });

  describe('userId extraction', () => {
    it('should extract userId from req.user.id', (done) => {
      const req = { user: { id: 'user-123' }, headers: {}, ip: '127.0.0.1' };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userId).toBe('user-123');
        done();
      });
    });

    it('should fall back to req.user.sub when req.user.id is missing', (done) => {
      const req = { user: { sub: 'sub-456' }, headers: {}, ip: '127.0.0.1' };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userId).toBe('sub-456');
        done();
      });
    });

    it('should prefer req.user.id over req.user.sub', (done) => {
      const req = {
        user: { id: 'user-123', sub: 'sub-456' },
        headers: {},
        ip: '127.0.0.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userId).toBe('user-123');
        done();
      });
    });

    it('should set userId to undefined when no user on request', (done) => {
      const req = { headers: {}, ip: '127.0.0.1' };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userId).toBeUndefined();
        done();
      });
    });

    it('should set userId to undefined when user exists but has no id or sub', (done) => {
      const req = { user: { email: 'test@test.com' }, headers: {}, ip: '127.0.0.1' };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userId).toBeUndefined();
        done();
      });
    });
  });

  describe('ipAddress extraction', () => {
    it('should extract IP from x-forwarded-for header', (done) => {
      const req = {
        headers: { 'x-forwarded-for': '10.0.0.1' },
        ip: '127.0.0.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.ipAddress).toBe('10.0.0.1');
        done();
      });
    });

    it('should extract the first IP from comma-separated x-forwarded-for', (done) => {
      const req = {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' },
        ip: '127.0.0.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.ipAddress).toBe('10.0.0.1');
        done();
      });
    });

    it('should trim whitespace from x-forwarded-for IP', (done) => {
      const req = {
        headers: { 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' },
        ip: '127.0.0.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.ipAddress).toBe('10.0.0.1');
        done();
      });
    });

    it('should fall back to req.ip when no x-forwarded-for header', (done) => {
      const req = {
        headers: {},
        ip: '192.168.1.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.ipAddress).toBe('192.168.1.1');
        done();
      });
    });

    it('should fall back to req.socket.remoteAddress when no ip', (done) => {
      const req = {
        headers: {},
        socket: { remoteAddress: '172.16.0.1' },
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.ipAddress).toBe('172.16.0.1');
        done();
      });
    });

    it('should be undefined when no IP source is available', (done) => {
      const req = { headers: {} };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.ipAddress).toBeUndefined();
        done();
      });
    });
  });

  describe('userAgent extraction', () => {
    it('should extract user-agent header', (done) => {
      const req = {
        headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
        ip: '127.0.0.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userAgent).toBe('Mozilla/5.0 TestBrowser');
        done();
      });
    });

    it('should be undefined when no user-agent header', (done) => {
      const req = { headers: {}, ip: '127.0.0.1' };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store?.userAgent).toBeUndefined();
        done();
      });
    });
  });

  describe('AsyncLocalStorage behavior', () => {
    it('should store context in AsyncLocalStorage accessible within next()', (done) => {
      const req = {
        user: { id: 'user-1' },
        headers: { 'user-agent': 'TestAgent/1.0' },
        ip: '10.0.0.1',
      };

      middleware.use(req, {}, () => {
        const store = auditContextStorage.getStore();
        expect(store).toBeDefined();
        expect(store).toEqual({
          userId: 'user-1',
          ipAddress: '10.0.0.1',
          userAgent: 'TestAgent/1.0',
        });
        done();
      });
    });

    it('should not have context outside the middleware run scope', () => {
      const store = auditContextStorage.getStore();
      expect(store).toBeUndefined();
    });
  });

  describe('next() invocation', () => {
    it('should call next()', () => {
      const req = { headers: {}, ip: '127.0.0.1' };
      const next = jest.fn();

      middleware.use(req, {}, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
