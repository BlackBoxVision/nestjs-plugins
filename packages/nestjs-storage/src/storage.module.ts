import { DynamicModule, Module, Provider, Type } from '@nestjs/common';

import {
  StorageModuleOptions,
  StorageModuleAsyncOptions,
  StorageProvider,
  STORAGE_MODULE_OPTIONS,
  STORAGE_PROVIDER,
} from './interfaces';
import { S3StorageProvider } from './providers/s3.provider';
import { FirebaseStorageProvider } from './providers/firebase.provider';
import { DOSpacesStorageProvider } from './providers/do-spaces.provider';
import { LocalStorageProvider } from './providers/local.provider';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

function createProvider(options: StorageModuleOptions): StorageProvider {
  switch (options.provider) {
    case 's3':
      return new S3StorageProvider(options.providerOptions);
    case 'firebase':
      return new FirebaseStorageProvider(options.providerOptions);
    case 'do_spaces':
      return new DOSpacesStorageProvider(options.providerOptions);
    case 'local':
      return new LocalStorageProvider(options.providerOptions);
    default:
      throw new Error(
        `Unsupported storage provider: ${(options as any).provider}`,
      );
  }
}

function getControllers(
  options: StorageModuleOptions,
): Type<any>[] {
  if (options.features?.registerController) {
    return [StorageController];
  }

  return [];
}

@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: STORAGE_MODULE_OPTIONS,
      useValue: options,
    };

    const storageProviderFactory: Provider = {
      provide: STORAGE_PROVIDER,
      useValue: createProvider(options),
    };

    return {
      module: StorageModule,
      controllers: getControllers(options),
      providers: [optionsProvider, storageProviderFactory, StorageService],
      exports: [StorageService, STORAGE_PROVIDER],
    };
  }

  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: STORAGE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    const asyncStorageProvider: Provider = {
      provide: STORAGE_PROVIDER,
      useFactory: (moduleOptions: StorageModuleOptions) =>
        createProvider(moduleOptions),
      inject: [STORAGE_MODULE_OPTIONS],
    };

    return {
      module: StorageModule,
      imports: options.imports ?? [],
      controllers: [StorageController],
      providers: [
        asyncOptionsProvider,
        asyncStorageProvider,
        StorageService,
      ],
      exports: [StorageService, STORAGE_PROVIDER],
    };
  }
}
