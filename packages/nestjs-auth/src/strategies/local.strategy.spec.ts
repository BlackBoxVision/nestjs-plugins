jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (strategy: any) => class MockPassportStrategy {},
}));

import { UnauthorizedException } from '@nestjs/common';

import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      validateUser: jest.fn(),
    };
    strategy = new LocalStrategy(mockAuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should return user on successful validation', async () => {
    const user = {
      id: 'u1',
      email: 'test@test.com',
      emailVerified: true,
      isActive: true,
    };
    mockAuthService.validateUser.mockResolvedValue(user);

    const result = await strategy.validate('test@test.com', 'password123');

    expect(result).toEqual(user);
    expect(mockAuthService.validateUser).toHaveBeenCalledWith(
      'test@test.com',
      'password123',
    );
  });

  it('should throw UnauthorizedException when validateUser returns null', async () => {
    mockAuthService.validateUser.mockResolvedValue(null);

    await expect(
      strategy.validate('bad@test.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockAuthService.validateUser).toHaveBeenCalledWith(
      'bad@test.com',
      'wrong-password',
    );
  });

  it('should throw UnauthorizedException with correct message when validation fails', async () => {
    mockAuthService.validateUser.mockResolvedValue(null);

    await expect(
      strategy.validate('bad@test.com', 'wrong'),
    ).rejects.toThrow('Invalid email or password');
  });

  it('should throw UnauthorizedException when validateUser returns undefined', async () => {
    mockAuthService.validateUser.mockResolvedValue(undefined);

    await expect(
      strategy.validate('test@test.com', 'password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should call validateUser exactly once per validate call', async () => {
    const user = {
      id: 'u1',
      email: 'test@test.com',
      emailVerified: true,
      isActive: true,
    };
    mockAuthService.validateUser.mockResolvedValue(user);

    await strategy.validate('test@test.com', 'password');

    expect(mockAuthService.validateUser).toHaveBeenCalledTimes(1);
  });
});
