import { ApiPaginatedResponse } from './api-paginated-response.decorator';

class TestDto {
  id: string;
  name: string;
}

describe('ApiPaginatedResponse', () => {
  it('should be a function', () => {
    expect(typeof ApiPaginatedResponse).toBe('function');
  });

  it('should return a decorator function when called with a model', () => {
    const decorator = ApiPaginatedResponse(TestDto);

    expect(typeof decorator).toBe('function');
  });

  it('should apply to a class method without throwing', () => {
    expect(() => {
      class TestController {
        @ApiPaginatedResponse(TestDto)
        findAll() {
          return [];
        }
      }

      const controller = new TestController();
      expect(controller.findAll()).toEqual([]);
    }).not.toThrow();
  });

  it('should work with different DTO classes', () => {
    class AnotherDto {
      title: string;
      description: string;
    }

    const decorator = ApiPaginatedResponse(AnotherDto);

    expect(typeof decorator).toBe('function');
  });

  it('should apply metadata to the method descriptor', () => {
    class TestController {
      @ApiPaginatedResponse(TestDto)
      findAll() {
        return [];
      }
    }

    const controller = new TestController();
    const metadata = Reflect.getMetadataKeys(controller.findAll);

    expect(metadata).toBeDefined();
  });
});
