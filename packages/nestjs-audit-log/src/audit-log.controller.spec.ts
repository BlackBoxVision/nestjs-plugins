import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_MODULE_OPTIONS, AuditLogModuleOptions } from './interfaces';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let mockAuditLogService: jest.Mocked<Pick<AuditLogService, 'findAll' | 'findById' | 'findByEntity'>>;
  let mockOptions: AuditLogModuleOptions;

  beforeEach(() => {
    mockAuditLogService = {
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      findById: jest.fn().mockResolvedValue(null),
      findByEntity: jest.fn().mockResolvedValue([]),
    };

    mockOptions = {
      features: { registerController: true },
      adminRoles: ['ADMIN'],
    };

    controller = new AuditLogController(
      mockAuditLogService as any,
      mockOptions,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call service.findAll with all undefined when no query params provided', async () => {
      await controller.findAll();

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        userId: undefined,
        entity: undefined,
        entityId: undefined,
        action: undefined,
        startDate: undefined,
        endDate: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it('should parse page and limit as integers and dates as Date objects', async () => {
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-12-31T23:59:59.999Z';

      await controller.findAll(
        'user-1',
        'Claim',
        'claim-1',
        'UPDATE',
        startDate,
        endDate,
        '2',
        '10',
      );

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        userId: 'user-1',
        entity: 'Claim',
        entityId: 'claim-1',
        action: 'UPDATE',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        page: 2,
        limit: 10,
      });
    });

    it('should handle partial query params correctly', async () => {
      await controller.findAll(
        'user-1',
        undefined,
        undefined,
        'CREATE',
        undefined,
        undefined,
        '1',
        undefined,
      );

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith({
        userId: 'user-1',
        entity: undefined,
        entityId: undefined,
        action: 'CREATE',
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: undefined,
      });
    });

    it('should return the result from service.findAll', async () => {
      const expectedResult = {
        data: [{ id: 'log-1', action: 'CREATE' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockAuditLogService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
    });

    it('should pass string params through without transformation', async () => {
      await controller.findAll(
        'user-abc',
        'Order',
        'order-123',
        'DELETE',
      );

      expect(mockAuditLogService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-abc',
          entity: 'Order',
          entityId: 'order-123',
          action: 'DELETE',
        }),
      );
    });
  });

  describe('findById', () => {
    it('should delegate to service.findById with the provided id', async () => {
      const mockLog = { id: 'log-1', action: 'CREATE', entity: 'Claim' };
      mockAuditLogService.findById.mockResolvedValue(mockLog);

      const result = await controller.findById('log-1');

      expect(mockAuditLogService.findById).toHaveBeenCalledWith('log-1');
      expect(result).toEqual(mockLog);
    });

    it('should return null when log is not found', async () => {
      mockAuditLogService.findById.mockResolvedValue(null);

      const result = await controller.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEntity', () => {
    it('should delegate to service.findByEntity with entity and entityId', async () => {
      const mockLogs = [
        { id: 'log-1', entity: 'Claim', entityId: 'c-1', action: 'CREATE' },
        { id: 'log-2', entity: 'Claim', entityId: 'c-1', action: 'UPDATE' },
      ];
      mockAuditLogService.findByEntity.mockResolvedValue(mockLogs);

      const result = await controller.findByEntity('Claim', 'c-1');

      expect(mockAuditLogService.findByEntity).toHaveBeenCalledWith('Claim', 'c-1');
      expect(result).toEqual(mockLogs);
    });

    it('should return empty array when no logs found for entity', async () => {
      mockAuditLogService.findByEntity.mockResolvedValue([]);

      const result = await controller.findByEntity('Unknown', 'x-1');

      expect(result).toEqual([]);
    });
  });
});
