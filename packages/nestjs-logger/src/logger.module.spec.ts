import { Test } from '@nestjs/testing';
import { LoggerModule } from './logger.module';

describe('LoggerModule', () => {
  it('should register with forRoot', async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ prettyPrint: true })],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should register with forRootAsync', async () => {
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRootAsync({
          useFactory: () => ({ prettyPrint: true }),
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
  });
});
