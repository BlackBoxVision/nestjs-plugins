import { LogPushProvider } from './log.provider';

describe('LogPushProvider', () => {
  let provider: LogPushProvider;

  beforeEach(() => {
    provider = new LogPushProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should resolve successfully on send', async () => {
    await expect(
      provider.send({ token: 'test-token', title: 'Test', body: 'Test push' }),
    ).resolves.toBeUndefined();
  });

  it('should resolve with optional data', async () => {
    await expect(
      provider.send({
        token: 'test-token',
        title: 'Test',
        body: 'Test push',
        data: { key: 'value' },
      }),
    ).resolves.toBeUndefined();
  });
});
