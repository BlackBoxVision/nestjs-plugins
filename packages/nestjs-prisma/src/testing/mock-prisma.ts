/**
 * Creates a deeply mocked PrismaService for unit testing.
 *
 * Returns an object with common Prisma Client methods stubbed as `jest.fn()`.
 * Projects can extend this mock by adding model-specific stubs.
 *
 * Usage:
 * ```ts
 * const prisma = createMockPrismaService();
 * prisma.user.findUnique.mockResolvedValue({ id: 1, name: 'Test' });
 * ```
 */

type MockPrismaModelDelegate = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findFirstOrThrow: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  upsert: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

export type MockPrismaService = {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  $on: jest.Mock;
  $use: jest.Mock;
  onModuleInit: jest.Mock;
  onModuleDestroy: jest.Mock;
} & Record<string, MockPrismaModelDelegate>;

function createMockModelDelegate(): MockPrismaModelDelegate {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

/**
 * Creates a mock PrismaService with all common client methods and a Proxy
 * that auto-generates model delegates on first access.
 *
 * Any property access that is not a known client method (like `$connect`)
 * will return a cached model delegate with all CRUD methods mocked.
 */
export function createMockPrismaService(): MockPrismaService {
  const modelCache = new Map<string, MockPrismaModelDelegate>();

  const baseMethods = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation((fn: any) => {
      if (typeof fn === 'function') {
        return fn(createMockPrismaService());
      }
      return Promise.resolve([]);
    }),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $on: jest.fn(),
    $use: jest.fn(),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };

  return new Proxy(baseMethods, {
    get(target: any, prop: string | symbol): any {
      if (typeof prop === 'symbol') {
        return undefined;
      }

      // Return known base methods directly
      if (prop in target) {
        return target[prop];
      }

      // Auto-create and cache model delegates
      if (!modelCache.has(prop)) {
        modelCache.set(prop, createMockModelDelegate());
      }

      return modelCache.get(prop);
    },
  }) as MockPrismaService;
}
