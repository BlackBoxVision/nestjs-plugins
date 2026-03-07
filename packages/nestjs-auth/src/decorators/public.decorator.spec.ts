import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public Decorator', () => {
  it('should have IS_PUBLIC_KEY equal to "isPublic"', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should set IS_PUBLIC_KEY metadata to true on the target', () => {
    @Public()
    class TestController {}

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController);
    expect(metadata).toBe(true);
  });

  it('should set metadata on method when applied to a method', () => {
    class TestController {
      @Public()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.testMethod,
    );
    expect(metadata).toBe(true);
  });

  it('should not set metadata on undecorated class', () => {
    class UndecoratedController {}

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, UndecoratedController);
    expect(metadata).toBeUndefined();
  });
});
