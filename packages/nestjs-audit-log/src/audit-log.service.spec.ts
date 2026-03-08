import { Test, TestingModule } from '@nestjs/testing';
import { PRISMA_SERVICE, createMockPrismaService } from '@bbv/nestjs-prisma';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_MODULE_OPTIONS, AuditLogModuleOptions } from './interfaces';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockPrisma: any;
  let mockOptions: AuditLogModuleOptions;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findUnique.mockResolvedValue(null);
    mockPrisma.auditLog.count.mockResolvedValue(0);
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    mockOptions = {
      features: {
        autoTrackCrud: true,
        trackChanges: true,
      },
      excludeEntities: [],
      excludeFields: ['password'],
      adminRoles: ['ADMIN'],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PRISMA_SERVICE, useValue: mockPrisma },
        { provide: AUDIT_LOG_MODULE_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      await service.log({
        userId: 'user-1',
        action: 'CREATE',
        entity: 'Claim',
        entityId: 'claim-1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'CREATE',
          entity: 'Claim',
          entityId: 'claim-1',
          changes: null,
          metadata: null,
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    it('should create an audit log entry with changes and metadata', async () => {
      const changes = { status: { old: 'PENDING', new: 'APPROVED' } };
      const metadata = { reason: 'Valid claim' };

      await service.log({
        userId: 'user-2',
        action: 'UPDATE',
        entity: 'Claim',
        entityId: 'claim-2',
        changes,
        metadata,
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-2',
          action: 'UPDATE',
          entity: 'Claim',
          entityId: 'claim-2',
          changes,
          metadata,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent/1.0',
        },
      });
    });

    it('should handle null optional fields gracefully', async () => {
      await service.log({ action: 'LOGIN' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'LOGIN',
          entity: null,
          entityId: null,
          changes: null,
          metadata: null,
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    it('should not throw when prisma create fails', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({ action: 'FAIL_TEST' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated results with defaults', async () => {
      const mockData = [
        { id: 'log-1', action: 'CREATE', createdAt: new Date() },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockData);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result).toEqual({
        data: mockData,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply all filter parameters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      await service.findAll({
        userId: 'user-1',
        entity: 'Claim',
        entityId: 'claim-1',
        action: 'UPDATE',
        startDate,
        endDate,
        page: 2,
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          entity: 'Claim',
          entityId: 'claim-1',
          action: 'UPDATE',
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    it('should calculate total pages correctly', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(45);

      const result = await service.findAll({ limit: 10 });

      expect(result.totalPages).toBe(5);
    });
  });

  describe('findById', () => {
    it('should return a single audit log by id', async () => {
      const mockLog = { id: 'log-1', action: 'CREATE' };
      mockPrisma.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await service.findById('log-1');

      expect(result).toEqual(mockLog);
      expect(mockPrisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-1' },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEntity', () => {
    it('should query by entity and entityId', async () => {
      const mockLogs = [
        { id: 'log-1', entity: 'Claim', entityId: 'c-1', action: 'CREATE' },
        { id: 'log-2', entity: 'Claim', entityId: 'c-1', action: 'UPDATE' },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.findByEntity('Claim', 'c-1');

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entity: 'Claim', entityId: 'c-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should return empty array when no logs found', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.findByEntity('Unknown', 'x-1');

      expect(result).toEqual([]);
    });
  });

  describe('findByUser', () => {
    it('should delegate to findAll with userId set', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findByUser('user-1', { page: 2, limit: 5 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });
  });

  describe('cleanup', () => {
    it('should delete logs older than specified days', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 15 });

      const result = await service.cleanup(90);

      expect(result).toBe(15);
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should return zero when no logs to clean', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanup(30);

      expect(result).toBe(0);
    });

    it('should calculate cutoff date correctly', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      const beforeCall = new Date();
      beforeCall.setDate(beforeCall.getDate() - 60);

      await service.cleanup(60);

      const callArg =
        mockPrisma.auditLog.deleteMany.mock.calls[0]?.[0]?.where?.createdAt?.lt;
      expect(callArg).toBeInstanceOf(Date);

      const diffMs = Math.abs(callArg.getTime() - beforeCall.getTime());
      expect(diffMs).toBeLessThan(1000);
    });
  });
});
