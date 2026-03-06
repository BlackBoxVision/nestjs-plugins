import { DynamicModule, Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  PrismaModuleOptions,
  PrismaModuleAsyncOptions,
} from './interfaces';

const PRISMA_MODULE_OPTIONS = 'PRISMA_MODULE_OPTIONS';

@Module({})
export class PrismaModule {
  static forRoot(options?: PrismaModuleOptions): DynamicModule {
    const providers = [PrismaService];

    const module: DynamicModule = {
      module: PrismaModule,
      providers,
      exports: [PrismaService],
    };

    if (options?.isGlobal) {
      module.global = true;
    }

    return module;
  }

  static forRootAsync(options: PrismaModuleAsyncOptions): DynamicModule {
    const asyncProviders = [
      {
        provide: PRISMA_MODULE_OPTIONS,
        useFactory: options.useFactory ?? (() => ({})),
        inject: options.inject ?? [],
      },
      PrismaService,
    ];

    const module: DynamicModule = {
      module: PrismaModule,
      imports: options.imports ?? [],
      providers: asyncProviders,
      exports: [PrismaService],
    };

    if (options.isGlobal) {
      module.global = true;
    }

    return module;
  }
}
