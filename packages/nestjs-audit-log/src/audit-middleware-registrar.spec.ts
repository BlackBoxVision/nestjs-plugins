import { Test } from '@nestjs/testing';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import { AuditMiddlewareRegistrar } from './audit-middleware-registrar';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_MODULE_OPTIONS } from './interfaces';

describe('AuditMiddlewareRegistrar', () => {
  const mockAuditLogService = {} as AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function createRegistrar(
    options: Record<string, any> = {},
    prismaOverride?: any,
  ) {
    const mockPrisma = prismaOverride ?? { $use: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuditMiddlewareRegistrar,
        { provide: PRISMA_SERVICE, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: AUDIT_LOG_MODULE_OPTIONS, useValue: options },
      ],
    }).compile();

    return { registrar: module.get(AuditMiddlewareRegistrar), prisma: mockPrisma };
  }

  it('should call prisma.$use when autoTrackCrud is true and $use is available', async () => {
    const { registrar, prisma } = await createRegistrar({
      features: { autoTrackCrud: true },
    });

    registrar.onModuleInit();

    expect(prisma.$use).toHaveBeenCalledTimes(1);
    expect(prisma.$use).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should not call prisma.$use when autoTrackCrud is false', async () => {
    const { registrar, prisma } = await createRegistrar({
      features: { autoTrackCrud: false },
    });

    registrar.onModuleInit();

    expect(prisma.$use).not.toHaveBeenCalled();
  });

  it('should not call prisma.$use when autoTrackCrud is undefined', async () => {
    const { registrar, prisma } = await createRegistrar({
      features: {},
    });

    registrar.onModuleInit();

    expect(prisma.$use).not.toHaveBeenCalled();
  });

  it('should not call prisma.$use when features is undefined', async () => {
    const { registrar, prisma } = await createRegistrar({});

    registrar.onModuleInit();

    expect(prisma.$use).not.toHaveBeenCalled();
  });

  it('should not call prisma.$use with empty options', async () => {
    const { registrar, prisma } = await createRegistrar();

    registrar.onModuleInit();

    expect(prisma.$use).not.toHaveBeenCalled();
  });

  it('should fall back to query wrapping when $use is not available', async () => {
    const mockPrisma = {
      item: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const { registrar } = await createRegistrar(
      { features: { autoTrackCrud: true } },
      mockPrisma,
    );

    // Should not throw when $use is missing
    expect(() => registrar.onModuleInit()).not.toThrow();
  });

  it('should preserve PrismaPromise object when wrapping methods (no async conversion)', async () => {
    // Simulate a PrismaPromise with internal query data (like Prisma 6 uses for $transaction)
    const fakeResult = { id: '1', name: 'test' };
    const fakePrismaPromise = {
      _internalQueryData: { model: 'Item', action: 'create' },
      then: jest.fn((onFulfilled: any) => Promise.resolve(onFulfilled(fakeResult))),
    };

    const mockCreate = jest.fn(() => fakePrismaPromise);
    const mockPrisma = {
      item: {
        create: mockCreate as any,
        findMany: jest.fn(),
      },
    };

    const { registrar } = await createRegistrar(
      { features: { autoTrackCrud: true } },
      mockPrisma,
    );

    registrar.onModuleInit();

    // Call the wrapped method
    const returned = (mockPrisma.item.create as any)({ data: { name: 'test' } });

    // The returned object should be the same PrismaPromise reference (not a new Promise)
    expect(returned).toBe(fakePrismaPromise);
    // Internal query data should still be accessible for $transaction
    expect(returned._internalQueryData).toEqual({ model: 'Item', action: 'create' });
  });

  it('should still invoke audit callback after wrapped method resolves', async () => {
    const fakeResult = { id: '1', name: 'test' };
    const fakePrismaPromise = {
      then: (onFulfilled: any, onRejected?: any) =>
        Promise.resolve(fakeResult).then(onFulfilled, onRejected),
    };

    const mockCreate = jest.fn(() => fakePrismaPromise);
    const mockLog = jest.fn().mockResolvedValue(undefined);
    const mockAudit = { log: mockLog } as any;

    const mockPrisma = {
      item: {
        create: mockCreate as any,
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditMiddlewareRegistrar,
        { provide: PRISMA_SERVICE, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAudit },
        {
          provide: AUDIT_LOG_MODULE_OPTIONS,
          useValue: { features: { autoTrackCrud: true } },
        },
      ],
    }).compile();

    const registrar = module.get(AuditMiddlewareRegistrar);
    registrar.onModuleInit();

    // Trigger the wrapped create and await via .then()
    const result = await (mockPrisma.item.create as any)({ data: { name: 'test' } });

    expect(result).toEqual(fakeResult);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'Item',
        entityId: '1',
      }),
    );
  });
});
