jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (strategy: any) => class MockPassportStrategy {},
}));
jest.mock('passport-jwt', () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn().mockReturnValue(() => 'token'),
  },
  Strategy: class MockJwtStrategy {},
}));

import { UnauthorizedException } from '@nestjs/common';

import { AuthModuleOptions } from '../interfaces';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockOptions: AuthModuleOptions;

  beforeEach(() => {
    mockOptions = {
      jwt: {
        secret: 'test-secret-key',
        expiresIn: '1h',
      },
    };
    strategy = new JwtStrategy(mockOptions);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should return AuthenticatedUser from valid payload', () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      iat: 1000000,
      exp: 2000000,
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      isActive: true,
    });
  });

  it('should throw UnauthorizedException when sub is missing', () => {
    const payload = {
      sub: '',
      email: 'test@example.com',
    };

    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when sub is undefined', () => {
    const payload = {
      sub: undefined as any,
      email: 'test@example.com',
    };

    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when email is missing', () => {
    const payload = {
      sub: 'user-123',
      email: '',
    };

    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when email is undefined', () => {
    const payload = {
      sub: 'user-123',
      email: undefined as any,
    };

    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with correct message for invalid payload', () => {
    const payload = {
      sub: '',
      email: '',
    };

    expect(() => strategy.validate(payload)).toThrow('Invalid token payload');
  });

  it('should map sub to id in returned user', () => {
    const payload = {
      sub: 'abc-def-ghi',
      email: 'user@domain.com',
    };

    const result = strategy.validate(payload);

    expect(result.id).toBe('abc-def-ghi');
    expect(result.email).toBe('user@domain.com');
  });

  it('should always return emailVerified as true and isActive as true', () => {
    const payload = {
      sub: 'user-1',
      email: 'user@test.com',
    };

    const result = strategy.validate(payload);

    expect(result.emailVerified).toBe(true);
    expect(result.isActive).toBe(true);
  });
});
