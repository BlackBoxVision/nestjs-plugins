import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { CurrentUser } from './current-user.decorator';

function getParamDecoratorFactory(decorator: Function) {
  class Test {
    test(@decorator() value: any) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  let factory: Function;

  beforeEach(() => {
    factory = getParamDecoratorFactory(CurrentUser);
  });

  const createMockExecutionContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  it('should return the full user object when no data param is provided', () => {
    const user = {
      id: 'u1',
      email: 'test@test.com',
      emailVerified: true,
      isActive: true,
    };
    const ctx = createMockExecutionContext(user);

    const result = factory(undefined, ctx);

    expect(result).toEqual(user);
  });

  it('should return a specific user property when data param is provided', () => {
    const user = {
      id: 'u1',
      email: 'test@test.com',
      emailVerified: true,
      isActive: true,
    };
    const ctx = createMockExecutionContext(user);

    const result = factory('email', ctx);

    expect(result).toBe('test@test.com');
  });

  it('should return the id property when data is "id"', () => {
    const user = { id: 'user-123', email: 'a@b.com' };
    const ctx = createMockExecutionContext(user);

    const result = factory('id', ctx);

    expect(result).toBe('user-123');
  });

  it('should return undefined when no user is on the request and no data param', () => {
    const ctx = createMockExecutionContext(undefined);

    const result = factory(undefined, ctx);

    expect(result).toBeUndefined();
  });

  it('should return undefined when no user is on the request and data param is provided', () => {
    const ctx = createMockExecutionContext(undefined);

    const result = factory('email', ctx);

    expect(result).toBeUndefined();
  });

  it('should return undefined when user is null and data param is provided', () => {
    const ctx = createMockExecutionContext(null);

    const result = factory('email', ctx);

    expect(result).toBeUndefined();
  });

  it('should return null when user is null and no data param', () => {
    const ctx = createMockExecutionContext(null);

    const result = factory(undefined, ctx);

    expect(result).toBeNull();
  });

  it('should return undefined for a non-existent property on user', () => {
    const user = { id: 'u1', email: 'a@b.com' };
    const ctx = createMockExecutionContext(user);

    const result = factory('nonExistentProp', ctx);

    expect(result).toBeUndefined();
  });
});
