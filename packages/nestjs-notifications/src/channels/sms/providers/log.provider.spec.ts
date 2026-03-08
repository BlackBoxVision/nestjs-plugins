import { LogSmsProvider } from './log.provider';

describe('LogSmsProvider', () => {
  let provider: LogSmsProvider;

  beforeEach(() => {
    provider = new LogSmsProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should resolve successfully on send', async () => {
    await expect(
      provider.send({ to: '+15551234567', body: 'Test SMS' }),
    ).resolves.toBeUndefined();
  });

  it('should resolve with optional from', async () => {
    await expect(
      provider.send({ to: '+15551234567', body: 'Test SMS', from: '+15559999999' }),
    ).resolves.toBeUndefined();
  });
});
