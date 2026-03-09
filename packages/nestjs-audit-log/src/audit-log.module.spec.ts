import { AuditLogModule } from './audit-log.module';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AUDIT_LOG_MODULE_OPTIONS } from './interfaces';
import { AuditedInterceptor } from './decorators/audited.decorator';
import { AuditMiddlewareRegistrar } from './audit-middleware-registrar';

describe('AuditLogModule', () => {
  describe('forRoot', () => {
    it('should return a DynamicModule with required providers', () => {
      const result = AuditLogModule.forRoot();

      expect(result.module).toBe(AuditLogModule);
      expect(result.providers).toBeDefined();

      const providerTokens = result.providers!.map((p: any) =>
        typeof p === 'function' ? p : p.provide,
      );

      expect(providerTokens).toContain(AuditLogService);
      expect(providerTokens).toContain(AuditedInterceptor);
      expect(providerTokens).toContain(AUDIT_LOG_MODULE_OPTIONS);
      expect(providerTokens).toContain(AuditMiddlewareRegistrar);
    });

    it('should be globally scoped', () => {
      const result = AuditLogModule.forRoot();

      expect(result.global).toBe(true);
    });

    it('should export AuditLogService and AUDIT_LOG_MODULE_OPTIONS', () => {
      const result = AuditLogModule.forRoot();

      expect(result.exports).toContain(AuditLogService);
      expect(result.exports).toContain(AUDIT_LOG_MODULE_OPTIONS);
    });

    it('should include AuditLogController when registerController is true', () => {
      const result = AuditLogModule.forRoot({
        features: { registerController: true },
      });

      expect(result.controllers).toContain(AuditLogController);
    });

    it('should not include AuditLogController when registerController is false', () => {
      const result = AuditLogModule.forRoot({
        features: { registerController: false },
      });

      expect(result.controllers).not.toContain(AuditLogController);
    });

    it('should not include AuditLogController when registerController is not set', () => {
      const result = AuditLogModule.forRoot();

      expect(result.controllers).toEqual([]);
    });

    it('should not include AuditLogController with empty options', () => {
      const result = AuditLogModule.forRoot({});

      expect(result.controllers).toEqual([]);
    });

    it('should provide the options value via AUDIT_LOG_MODULE_OPTIONS', () => {
      const options = {
        features: { trackChanges: true },
        excludeEntities: ['Session'],
        excludeFields: ['password', 'secret'],
      };

      const result = AuditLogModule.forRoot(options);

      const optionsProvider = result.providers!.find(
        (p: any) => p.provide === AUDIT_LOG_MODULE_OPTIONS,
      ) as any;

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.useValue).toEqual(options);
    });

    it('should default to empty options when none provided', () => {
      const result = AuditLogModule.forRoot();

      const optionsProvider = result.providers!.find(
        (p: any) => p.provide === AUDIT_LOG_MODULE_OPTIONS,
      ) as any;

      expect(optionsProvider.useValue).toEqual({});
    });
  });

  describe('forRootAsync', () => {
    it('should return a DynamicModule with providers', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({
          features: { trackChanges: true },
        }),
      });

      expect(result.module).toBe(AuditLogModule);
      expect(result.providers).toBeDefined();
    });

    it('should be globally scoped', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({}),
      });

      expect(result.global).toBe(true);
    });

    it('should accept useFactory and inject', () => {
      const factory = jest.fn().mockReturnValue({ features: {} });

      const result = AuditLogModule.forRootAsync({
        useFactory: factory,
        inject: ['CONFIG_SERVICE'],
      });

      const asyncProvider = result.providers!.find(
        (p: any) => p.provide === AUDIT_LOG_MODULE_OPTIONS,
      ) as any;

      expect(asyncProvider).toBeDefined();
      expect(asyncProvider.useFactory).toBe(factory);
      expect(asyncProvider.inject).toEqual(['CONFIG_SERVICE']);
    });

    it('should default inject to empty array when not provided', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({}),
      });

      const asyncProvider = result.providers!.find(
        (p: any) => p.provide === AUDIT_LOG_MODULE_OPTIONS,
      ) as any;

      expect(asyncProvider.inject).toEqual([]);
    });

    it('should include imports when provided', () => {
      const mockModule = class MockModule {};

      const result = AuditLogModule.forRootAsync({
        imports: [mockModule],
        useFactory: () => ({}),
      });

      expect(result.imports).toContain(mockModule);
    });

    it('should default imports to empty array when not provided', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({}),
      });

      expect(result.imports).toEqual([]);
    });

    it('should include AuditLogController in async configuration', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({}),
      });

      expect(result.controllers).toContain(AuditLogController);
    });

    it('should export AuditLogService and AUDIT_LOG_MODULE_OPTIONS', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({}),
      });

      expect(result.exports).toContain(AuditLogService);
      expect(result.exports).toContain(AUDIT_LOG_MODULE_OPTIONS);
    });

    it('should include AuditLogService and AuditedInterceptor in providers', () => {
      const result = AuditLogModule.forRootAsync({
        useFactory: () => ({}),
      });

      const providerTokens = result.providers!.map((p: any) =>
        typeof p === 'function' ? p : p.provide,
      );

      expect(providerTokens).toContain(AuditLogService);
      expect(providerTokens).toContain(AuditedInterceptor);
      expect(providerTokens).toContain(AuditMiddlewareRegistrar);
    });
  });

  describe('configure (NestModule)', () => {
    it('should apply AuditContextMiddleware for all routes', () => {
      const module = new AuditLogModule();

      const mockForRoutes = jest.fn();
      const mockApply = jest.fn().mockReturnValue({ forRoutes: mockForRoutes });
      const mockConsumer = { apply: mockApply } as any;

      module.configure(mockConsumer);

      expect(mockApply).toHaveBeenCalled();
      expect(mockForRoutes).toHaveBeenCalledWith('*');
    });
  });
});
