jest.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {
      $connect = jest.fn().mockResolvedValue(undefined);
      $disconnect = jest.fn().mockResolvedValue(undefined);
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaModule', () => {
  describe('forRoot', () => {
    it('should provide PrismaService', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [PrismaModule.forRoot()],
      }).compile();

      const service = module.get<PrismaService>(PrismaService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PrismaService);
    });

    it('should create a global module when isGlobal is true', () => {
      const dynamicModule = PrismaModule.forRoot({ isGlobal: true });

      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.exports).toContain(PrismaService);
    });

    it('should not be global by default', () => {
      const dynamicModule = PrismaModule.forRoot();

      expect(dynamicModule.global).toBeUndefined();
    });
  });

  describe('forRootAsync', () => {
    it('should provide PrismaService with async configuration', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PrismaModule.forRootAsync({
            useFactory: () => ({
              prismaServiceOptions: {
                explicitConnect: true,
              },
            }),
          }),
        ],
      }).compile();

      const service = module.get<PrismaService>(PrismaService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PrismaService);
    });

    it('should create a global module when isGlobal is true', () => {
      const dynamicModule = PrismaModule.forRootAsync({
        isGlobal: true,
        useFactory: () => ({}),
      });

      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.exports).toContain(PrismaService);
    });

    it('should accept imports array', () => {
      const dynamicModule = PrismaModule.forRootAsync({
        imports: [],
        useFactory: () => ({}),
      });

      expect(dynamicModule.imports).toEqual([]);
    });
  });
});
