jest.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {
      $connect = jest.fn().mockResolvedValue(undefined);
      $disconnect = jest.fn().mockResolvedValue(undefined);
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaModule } from '../src/prisma.module';
import { PrismaService } from '../src/prisma.service';

describe('PrismaModule (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule.forRoot()],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mock $connect and $disconnect to avoid real database connections in tests
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jest.spyOn(prismaService, '$connect').mockResolvedValue();
    jest.spyOn(prismaService, '$disconnect').mockResolvedValue();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should bootstrap the application with PrismaModule', () => {
    expect(app).toBeDefined();
  });

  it('should inject PrismaService', () => {
    expect(prismaService).toBeDefined();
    expect(prismaService).toBeInstanceOf(PrismaService);
  });

  it('should have called $connect on module init', () => {
    expect(prismaService.$connect).toHaveBeenCalled();
  });

  describe('forRoot with isGlobal', () => {
    let globalApp: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [PrismaModule.forRoot({ isGlobal: true })],
      }).compile();

      const service = moduleFixture.get<PrismaService>(PrismaService);
      jest.spyOn(service, '$connect').mockResolvedValue();
      jest.spyOn(service, '$disconnect').mockResolvedValue();

      globalApp = moduleFixture.createNestApplication();
      await globalApp.init();
    });

    afterAll(async () => {
      await globalApp.close();
    });

    it('should bootstrap with global PrismaModule', () => {
      expect(globalApp).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    let asyncApp: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
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

      const service = moduleFixture.get<PrismaService>(PrismaService);
      jest.spyOn(service, '$connect').mockResolvedValue();
      jest.spyOn(service, '$disconnect').mockResolvedValue();

      asyncApp = moduleFixture.createNestApplication();
      await asyncApp.init();
    });

    afterAll(async () => {
      await asyncApp.close();
    });

    it('should bootstrap with async PrismaModule configuration', () => {
      expect(asyncApp).toBeDefined();
    });
  });
});
