import { WorkerCleanupService } from './worker-cleanup.service';

describe('WorkerCleanupService', () => {
  function createMockWorker() {
    return { close: jest.fn().mockResolvedValue(undefined) };
  }

  it('should call close on all non-null workers', async () => {
    const emailWorker = createMockWorker();
    const smsWorker = createMockWorker();
    const pushWorker = createMockWorker();

    const service = new WorkerCleanupService(
      emailWorker as any,
      smsWorker as any,
      pushWorker as any,
    );

    await service.onModuleDestroy();

    expect(emailWorker.close).toHaveBeenCalledTimes(1);
    expect(smsWorker.close).toHaveBeenCalledTimes(1);
    expect(pushWorker.close).toHaveBeenCalledTimes(1);
  });

  it('should handle null workers gracefully', async () => {
    const service = new WorkerCleanupService(null, null, null);

    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });

  it('should handle mixed null and non-null workers', async () => {
    const smsWorker = createMockWorker();

    const service = new WorkerCleanupService(null, smsWorker as any, null);

    await service.onModuleDestroy();

    expect(smsWorker.close).toHaveBeenCalledTimes(1);
  });

  it('should not block other workers if one close fails', async () => {
    const emailWorker = { close: jest.fn().mockRejectedValue(new Error('close failed')) };
    const smsWorker = createMockWorker();
    const pushWorker = createMockWorker();

    const service = new WorkerCleanupService(
      emailWorker as any,
      smsWorker as any,
      pushWorker as any,
    );

    await expect(service.onModuleDestroy()).resolves.not.toThrow();

    expect(emailWorker.close).toHaveBeenCalledTimes(1);
    expect(smsWorker.close).toHaveBeenCalledTimes(1);
    expect(pushWorker.close).toHaveBeenCalledTimes(1);
  });
});
