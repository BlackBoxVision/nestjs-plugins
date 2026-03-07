import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles Decorator', () => {
  it('should have ROLES_KEY equal to "roles"', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('should set ROLES_KEY metadata with a single role', () => {
    class TestController {
      @Roles('admin')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      ROLES_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toEqual(['admin']);
  });

  it('should set ROLES_KEY metadata with multiple roles', () => {
    class TestController {
      @Roles('admin', 'editor', 'viewer')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      ROLES_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toEqual(['admin', 'editor', 'viewer']);
  });

  it('should set ROLES_KEY metadata with two roles', () => {
    class TestController {
      @Roles('admin', 'superadmin')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      ROLES_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toEqual(['admin', 'superadmin']);
  });

  it('should handle empty roles', () => {
    class TestController {
      @Roles()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      ROLES_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toEqual([]);
  });

  it('should work as a class decorator', () => {
    @Roles('admin')
    class TestController {}

    const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
    expect(metadata).toEqual(['admin']);
  });

  it('should not set metadata on undecorated methods', () => {
    class TestController {
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      ROLES_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toBeUndefined();
  });
});
