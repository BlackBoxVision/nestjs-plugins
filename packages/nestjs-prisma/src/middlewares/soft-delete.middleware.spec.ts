import { softDeleteMiddleware } from './soft-delete.middleware';

describe('softDeleteMiddleware', () => {
  let middleware: ReturnType<typeof softDeleteMiddleware>;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = softDeleteMiddleware();
    next = jest.fn().mockResolvedValue({ id: '1' });
  });

  describe('delete action', () => {
    it('should convert delete to update with deletedAt set', async () => {
      const params = {
        action: 'delete',
        args: { where: { id: '1' } },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.action).toBe('update');
      expect(params.args['data']).toBeDefined();
      expect(params.args['data']['deletedAt']).toBeInstanceOf(Date);
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should call next and return its result', async () => {
      const params = {
        action: 'delete',
        args: { where: { id: '1' } },
        model: 'User',
      };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ id: '1' });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteMany action', () => {
    it('should convert deleteMany to updateMany with deletedAt set', async () => {
      const params = {
        action: 'deleteMany',
        args: { where: { status: 'inactive' } },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.action).toBe('updateMany');
      expect(params.args['data']).toBeDefined();
      expect(params.args['data']['deletedAt']).toBeInstanceOf(Date);
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should add deletedAt to existing data when data is already present', async () => {
      const params = {
        action: 'deleteMany',
        args: {
          where: { status: 'inactive' },
          data: { archivedBy: 'admin' },
        },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.action).toBe('updateMany');
      expect(params.args['data']['archivedBy']).toBe('admin');
      expect(params.args['data']['deletedAt']).toBeInstanceOf(Date);
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should call next and return its result', async () => {
      const params = {
        action: 'deleteMany',
        args: { where: {} },
        model: 'User',
      };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ id: '1' });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('findMany action', () => {
    it('should add deletedAt: null to where clause', async () => {
      const params = {
        action: 'findMany',
        args: { where: { status: 'active' } },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toBeNull();
      expect(params.args['where']['status']).toBe('active');
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should create where clause with deletedAt: null when where is missing', async () => {
      const params = {
        action: 'findMany',
        args: {},
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']).toEqual({ deletedAt: null });
      expect(next).toHaveBeenCalledWith(params);
    });
  });

  describe('findUnique action', () => {
    it('should add deletedAt: null to where clause', async () => {
      const params = {
        action: 'findUnique',
        args: { where: { id: '1' } },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toBeNull();
      expect(params.args['where']['id']).toBe('1');
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should create where clause with deletedAt: null when where is missing', async () => {
      const params = {
        action: 'findUnique',
        args: {},
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']).toEqual({ deletedAt: null });
      expect(next).toHaveBeenCalledWith(params);
    });
  });

  describe('findFirst action', () => {
    it('should add deletedAt: null to where clause', async () => {
      const params = {
        action: 'findFirst',
        args: { where: { email: 'test@test.com' } },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toBeNull();
      expect(params.args['where']['email']).toBe('test@test.com');
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should create where clause with deletedAt: null when where is missing', async () => {
      const params = {
        action: 'findFirst',
        args: {},
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']).toEqual({ deletedAt: null });
      expect(next).toHaveBeenCalledWith(params);
    });
  });

  describe('count action', () => {
    it('should add deletedAt: null to where clause', async () => {
      const params = {
        action: 'count',
        args: { where: { status: 'active' } },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toBeNull();
      expect(params.args['where']['status']).toBe('active');
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should create where clause with deletedAt: null when where is missing', async () => {
      const params = {
        action: 'count',
        args: {},
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']).toEqual({ deletedAt: null });
      expect(next).toHaveBeenCalledWith(params);
    });
  });

  describe('preserving existing where clauses', () => {
    it('should preserve all existing where conditions for findMany', async () => {
      const params = {
        action: 'findMany',
        args: {
          where: { status: 'active', role: 'admin', age: { gte: 18 } },
        },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['status']).toBe('active');
      expect(params.args['where']['role']).toBe('admin');
      expect(params.args['where']['age']).toEqual({ gte: 18 });
      expect(params.args['where']['deletedAt']).toBeNull();
    });

    it('should preserve all existing where conditions for count', async () => {
      const params = {
        action: 'count',
        args: {
          where: { published: true, authorId: '42' },
        },
        model: 'Post',
      };

      await middleware(params as any, next);

      expect(params.args['where']['published']).toBe(true);
      expect(params.args['where']['authorId']).toBe('42');
      expect(params.args['where']['deletedAt']).toBeNull();
    });
  });

  describe('explicit deletedAt in where clause', () => {
    it('should NOT override explicit deletedAt for findMany', async () => {
      const explicitDate = new Date('2024-01-01');
      const params = {
        action: 'findMany',
        args: {
          where: { deletedAt: { not: null } },
        },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toEqual({ not: null });
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should NOT override explicit deletedAt for findUnique', async () => {
      const params = {
        action: 'findUnique',
        args: {
          where: { id: '1', deletedAt: new Date('2024-06-15') },
        },
        model: 'User',
      };

      const originalDeletedAt = params.args['where']['deletedAt'];
      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toBe(originalDeletedAt);
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should NOT override explicit deletedAt for findFirst', async () => {
      const params = {
        action: 'findFirst',
        args: {
          where: { deletedAt: { gte: new Date('2024-01-01') } },
        },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toEqual({
        gte: new Date('2024-01-01'),
      });
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should NOT override explicit deletedAt for count', async () => {
      const params = {
        action: 'count',
        args: {
          where: { deletedAt: { not: null } },
        },
        model: 'User',
      };

      await middleware(params as any, next);

      expect(params.args['where']['deletedAt']).toEqual({ not: null });
      expect(next).toHaveBeenCalledWith(params);
    });
  });

  describe('non-tracked actions passthrough', () => {
    it.each(['create', 'update', 'updateMany', 'aggregate', 'groupBy', 'upsert', 'createMany'])(
      'should pass through %s action unchanged',
      async (action) => {
        const originalArgs = { data: { name: 'Test' }, where: { id: '1' } };
        const params = {
          action,
          args: { ...originalArgs },
          model: 'User',
        };

        await middleware(params as any, next);

        expect(params.action).toBe(action);
        expect(next).toHaveBeenCalledWith(params);
      },
    );
  });

  describe('next function invocation', () => {
    it('should always call next exactly once for delete', async () => {
      const params = { action: 'delete', args: { where: { id: '1' } }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always call next exactly once for deleteMany', async () => {
      const params = { action: 'deleteMany', args: { where: {} }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always call next exactly once for findMany', async () => {
      const params = { action: 'findMany', args: { where: {} }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always call next exactly once for findUnique', async () => {
      const params = { action: 'findUnique', args: { where: { id: '1' } }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always call next exactly once for findFirst', async () => {
      const params = { action: 'findFirst', args: { where: {} }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always call next exactly once for count', async () => {
      const params = { action: 'count', args: { where: {} }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should always call next exactly once for passthrough actions', async () => {
      const params = { action: 'create', args: { data: { name: 'Test' } }, model: 'User' };
      await middleware(params as any, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return the result from next', async () => {
      next.mockResolvedValue({ id: '42', name: 'Result' });
      const params = { action: 'create', args: { data: {} }, model: 'User' };

      const result = await middleware(params as any, next);

      expect(result).toEqual({ id: '42', name: 'Result' });
    });
  });
});
