import { DynamicModule, Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  PrismaModuleOptions,
  PrismaModuleAsyncOptions,
} from './interfaces';

const PRISMA_MODULE_OPTIONS = 'PRISMA_MODULE_OPTIONS';

function createPrismaAliases() {
  return [
    { provide: 'PRISMA_SERVICE', useExisting: PrismaService },
  ];
}

@Module({})
export class PrismaModule {
  static forRoot(options?: PrismaModuleOptions): DynamicModule {
    const aliases = createPrismaAliases();
    const providers = [PrismaService, ...aliases];

    const module: DynamicModule = {
      module: PrismaModule,
      providers,
      exports: [PrismaService, ...aliases],
    };

    if (options?.isGlobal) {
      module.global = true;
    }

    return module;
  }

  static forRootAsync(options: PrismaModuleAsyncOptions): DynamicModule {
    const aliases = createPrismaAliases();
    const asyncProviders = [
      {
        provide: PRISMA_MODULE_OPTIONS,
        useFactory: options.useFactory ?? (() => ({})),
        inject: options.inject ?? [],
      },
      PrismaService,
      ...aliases,
    ];

    const module: DynamicModule = {
      module: PrismaModule,
      imports: options.imports ?? [],
      providers: asyncProviders,
      exports: [PrismaService, ...aliases],
    };

    if (options.isGlobal) {
      module.global = true;
    }

    return module;
  }
}
