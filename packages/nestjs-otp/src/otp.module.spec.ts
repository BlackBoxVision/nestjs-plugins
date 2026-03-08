import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';

import { OtpModule } from './otp.module';
import { OtpService } from './otp.service';
import { OTP_MODULE_OPTIONS, OtpModuleOptions } from './interfaces';

@Global()
@Module({
  providers: [
    { provide: PRISMA_SERVICE, useValue: {} },
    { provide: EventEmitter2, useValue: { emit: jest.fn() } },
  ],
  exports: [PRISMA_SERVICE, EventEmitter2],
})
class MockGlobalModule {}

const testOptions: OtpModuleOptions = {
  encryptionKey: 'test-encryption-key-32-chars-long',
  methods: {
    totp: {
      enabled: true,
      method: 'totp',
      issuer: 'TestApp',
    },
  },
  features: {
    totp: true,
    backupCodes: true,
  },
};

describe('OtpModule', () => {
  describe('forRoot', () => {
    it('should create module with TOTP provider', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [MockGlobalModule, OtpModule.forRoot(testOptions)],
      }).compile();

      const service = module.get<OtpService>(OtpService);
      expect(service).toBeDefined();

      const options = module.get(OTP_MODULE_OPTIONS);
      expect(options).toEqual(testOptions);
    });

    it('should not create TOTP provider when disabled', async () => {
      const disabledOptions: OtpModuleOptions = {
        ...testOptions,
        methods: {
          totp: { enabled: false },
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [MockGlobalModule, OtpModule.forRoot(disabledOptions)],
      }).compile();

      const service = module.get<OtpService>(OtpService);
      expect(service).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    it('should create module with async options', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          MockGlobalModule,
          OtpModule.forRootAsync({
            useFactory: () => testOptions,
          }),
        ],
      }).compile();

      const service = module.get<OtpService>(OtpService);
      expect(service).toBeDefined();
    });
  });
});
