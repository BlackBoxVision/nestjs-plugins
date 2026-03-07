import { createMockPrismaService, MockPrismaService } from './mock-prisma';

describe('createMockPrismaService', () => {
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
  });

  describe('base client methods', () => {
    it('should have $connect as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$connect)).toBe(true);
    });

    it('should have $disconnect as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$disconnect)).toBe(true);
    });

    it('should have $transaction as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$transaction)).toBe(true);
    });

    it('should have $queryRaw as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$queryRaw)).toBe(true);
    });

    it('should have $executeRaw as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$executeRaw)).toBe(true);
    });

    it('should have $on as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$on)).toBe(true);
    });

    it('should have $use as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.$use)).toBe(true);
    });

    it('should have onModuleInit as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.onModuleInit)).toBe(true);
    });

    it('should have onModuleDestroy as a jest.fn', () => {
      expect(jest.isMockFunction(prisma.onModuleDestroy)).toBe(true);
    });

    it('should resolve $connect to undefined', async () => {
      await expect(prisma.$connect()).resolves.toBeUndefined();
    });

    it('should resolve $disconnect to undefined', async () => {
      await expect(prisma.$disconnect()).resolves.toBeUndefined();
    });

    it('should resolve $queryRaw to an empty array', async () => {
      await expect(prisma.$queryRaw()).resolves.toEqual([]);
    });

    it('should resolve $executeRaw to 0', async () => {
      await expect(prisma.$executeRaw()).resolves.toBe(0);
    });
  });

  describe('model delegate auto-creation', () => {
    it('should return a model delegate for any property access', () => {
      const user = prisma.user;
      expect(user).toBeDefined();
      expect(jest.isMockFunction(user.findUnique)).toBe(true);
      expect(jest.isMockFunction(user.findMany)).toBe(true);
      expect(jest.isMockFunction(user.create)).toBe(true);
      expect(jest.isMockFunction(user.update)).toBe(true);
      expect(jest.isMockFunction(user.delete)).toBe(true);
    });

    it('should provide all CRUD methods on model delegates', () => {
      const post = prisma.post;
      const expectedMethods = [
        'findUnique',
        'findUniqueOrThrow',
        'findFirst',
        'findFirstOrThrow',
        'findMany',
        'create',
        'createMany',
        'update',
        'updateMany',
        'delete',
        'deleteMany',
        'upsert',
        'count',
        'aggregate',
        'groupBy',
      ];

      for (const method of expectedMethods) {
        expect(jest.isMockFunction((post as any)[method])).toBe(true);
      }
    });

    it('should cache model delegates (same reference on repeated access)', () => {
      const first = prisma.user;
      const second = prisma.user;
      expect(first).toBe(second);
    });

    it('should return different delegates for different model names', () => {
      const user = prisma.user;
      const post = prisma.post;
      expect(user).not.toBe(post);
    });

    it('should return undefined for symbol property access', () => {
      const sym = Symbol('test');
      expect((prisma as any)[sym]).toBeUndefined();
    });
  });

  describe('$transaction', () => {
    it('should call function argument with a new mock prisma service', async () => {
      const callback = jest.fn().mockResolvedValue('tx-result');
      const result = await prisma.$transaction(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(result).toBe('tx-result');

      // The argument passed to the callback should be a mock prisma service
      const txClient = callback.mock.calls[0][0];
      expect(jest.isMockFunction(txClient.$connect)).toBe(true);
      expect(txClient.someModel).toBeDefined();
      expect(jest.isMockFunction(txClient.someModel.findUnique)).toBe(true);
    });

    it('should resolve to an empty array when given an array argument', async () => {
      const result = await prisma.$transaction([
        Promise.resolve('a'),
        Promise.resolve('b'),
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('mock configurability', () => {
    it('should allow configuring model method return values', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@test.com' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await prisma.user.findUnique({ where: { id: '1' } });
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should allow configuring model method to reject', async () => {
      prisma.user.create.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(
        prisma.user.create({ data: { email: 'dup@test.com' } }),
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should track call counts across multiple invocations', async () => {
      prisma.post.findMany.mockResolvedValue([]);

      await prisma.post.findMany({ where: { published: true } });
      await prisma.post.findMany({ where: { published: false } });

      expect(prisma.post.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
