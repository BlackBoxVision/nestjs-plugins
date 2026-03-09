import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import {
  AuditLogModuleAsyncOptions,
  AuditLogModuleOptions,
  AUDIT_LOG_MODULE_OPTIONS,
} from './interfaces';
import { AuditContextMiddleware } from './middleware/prisma-audit.middleware';
import { AuditedInterceptor } from './decorators/audited.decorator';
import { AuditMiddlewareRegistrar } from './audit-middleware-registrar';

@Module({})
export class AuditLogModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditContextMiddleware).forRoutes('*');
  }

  static forRoot(options: AuditLogModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: AUDIT_LOG_MODULE_OPTIONS,
      useValue: options,
    };

    const controllers =
      options.features?.registerController ? [AuditLogController] : [];

    return {
      module: AuditLogModule,
      controllers,
      providers: [optionsProvider, AuditLogService, AuditedInterceptor, AuditMiddlewareRegistrar],
      exports: [AuditLogService, AUDIT_LOG_MODULE_OPTIONS],
      global: true,
    };
  }

  static forRootAsync(options: AuditLogModuleAsyncOptions): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: AUDIT_LOG_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: AuditLogModule,
      imports: options.imports ?? [],
      controllers: [AuditLogController],
      providers: [asyncOptionsProvider, AuditLogService, AuditedInterceptor, AuditMiddlewareRegistrar],
      exports: [AuditLogService, AUDIT_LOG_MODULE_OPTIONS],
      global: true,
    };
  }
}
