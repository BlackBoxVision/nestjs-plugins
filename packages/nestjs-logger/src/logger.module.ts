import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import {
  LoggerModuleOptions,
  LoggerModuleAsyncOptions,
  LOGGER_MODULE_OPTIONS,
} from './interfaces';

@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    const pinoConfig = LoggerModule.buildPinoConfig(options);

    return {
      module: LoggerModule,
      global: options.isGlobal ?? true,
      imports: [PinoLoggerModule.forRoot(pinoConfig)],
      providers: [
        { provide: LOGGER_MODULE_OPTIONS, useValue: options },
      ],
      exports: [PinoLoggerModule],
    };
  }

  static forRootAsync(asyncOptions: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      global: asyncOptions.isGlobal ?? true,
      imports: [
        ...(asyncOptions.imports ?? []),
        PinoLoggerModule.forRootAsync({
          imports: asyncOptions.imports,
          useFactory: async (...args: any[]) => {
            const options = await asyncOptions.useFactory(...args);
            return LoggerModule.buildPinoConfig(options);
          },
          inject: asyncOptions.inject ?? [],
        }),
      ],
      providers: [
        {
          provide: LOGGER_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
      ],
      exports: [PinoLoggerModule],
    };
  }

  private static buildPinoConfig(options: LoggerModuleOptions) {
    return {
      pinoHttp: {
        level: options.level ?? 'info',
        genReqId: (req: any) =>
          req.headers['x-request-id'] ?? crypto.randomUUID(),
        transport: options.prettyPrint
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      },
    };
  }
}
