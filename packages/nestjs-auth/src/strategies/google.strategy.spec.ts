jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (strategy: any) => class MockPassportStrategy {},
}));
jest.mock('passport-google-oauth20', () => ({
  Strategy: class MockGoogleStrategy {},
}));

import { GoogleStrategy } from './google.strategy';
import { GoogleProviderConfig } from '../interfaces';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let mockConfig: GoogleProviderConfig;

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'http://localhost:3000/auth/google/callback',
    };
    strategy = new GoogleStrategy(mockConfig);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should extract email, displayName, and avatarUrl from profile and call done', () => {
    const profile = {
      id: 'google-id-123',
      emails: [{ value: 'google@example.com', verified: true }],
      photos: [{ value: 'https://photo.url/avatar.jpg' }],
      displayName: 'John Doe',
    };
    const done = jest.fn();

    strategy.validate('access-token', 'refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerAccountId: 'google-id-123',
      email: 'google@example.com',
      displayName: 'John Doe',
      avatarUrl: 'https://photo.url/avatar.jpg',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('should handle missing emails gracefully', () => {
    const profile = {
      id: 'google-id-456',
      emails: undefined,
      photos: [{ value: 'https://photo.url/avatar.jpg' }],
      displayName: 'Jane Doe',
    };
    const done = jest.fn();

    strategy.validate('at', 'rt', profile, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerAccountId: 'google-id-456',
      email: undefined,
      displayName: 'Jane Doe',
      avatarUrl: 'https://photo.url/avatar.jpg',
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });

  it('should handle missing photos gracefully', () => {
    const profile = {
      id: 'google-id-789',
      emails: [{ value: 'user@example.com' }],
      photos: undefined,
      displayName: 'No Photo User',
    };
    const done = jest.fn();

    strategy.validate('at', 'rt', profile, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerAccountId: 'google-id-789',
      email: 'user@example.com',
      displayName: 'No Photo User',
      avatarUrl: undefined,
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });

  it('should handle empty emails array', () => {
    const profile = {
      id: 'google-id-000',
      emails: [],
      photos: [{ value: 'https://photo.url/pic.jpg' }],
      displayName: 'Empty Emails',
    };
    const done = jest.fn();

    strategy.validate('at', 'rt', profile, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerAccountId: 'google-id-000',
      email: undefined,
      displayName: 'Empty Emails',
      avatarUrl: 'https://photo.url/pic.jpg',
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });

  it('should handle empty photos array', () => {
    const profile = {
      id: 'google-id-111',
      emails: [{ value: 'user@test.com' }],
      photos: [],
      displayName: 'Empty Photos',
    };
    const done = jest.fn();

    strategy.validate('at', 'rt', profile, done);

    expect(done).toHaveBeenCalledWith(null, {
      provider: 'google',
      providerAccountId: 'google-id-111',
      email: 'user@test.com',
      displayName: 'Empty Photos',
      avatarUrl: undefined,
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });

  it('should pass accessToken and refreshToken from arguments', () => {
    const profile = {
      id: 'gid',
      emails: [{ value: 'e@e.com' }],
      photos: [{ value: 'https://pic.com/a.jpg' }],
      displayName: 'Test',
    };
    const done = jest.fn();

    strategy.validate('my-access-token', 'my-refresh-token', profile, done);

    const result = done.mock.calls[0][1];
    expect(result.accessToken).toBe('my-access-token');
    expect(result.refreshToken).toBe('my-refresh-token');
  });

  it('should always set provider to google', () => {
    const profile = {
      id: 'gid',
      emails: [{ value: 'e@e.com' }],
      photos: [],
      displayName: 'Test',
    };
    const done = jest.fn();

    strategy.validate('at', 'rt', profile, done);

    const result = done.mock.calls[0][1];
    expect(result.provider).toBe('google');
  });
});
