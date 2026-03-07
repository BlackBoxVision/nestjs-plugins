import { createPaginatedResponseDto } from './paginated-response.dto';

class TestItemDto {
  id: string;
  name: string;
}

describe('createPaginatedResponseDto', () => {
  it('should create a schema class with the correct name', () => {
    const SchemaClass = createPaginatedResponseDto(TestItemDto);
    expect(SchemaClass.name).toBe('PaginatedTestItemDtoResponse');
  });

  it('should be instantiable', () => {
    const SchemaClass = createPaginatedResponseDto(TestItemDto);
    const instance = new SchemaClass();
    expect(instance).toBeDefined();
  });

  it('should work with different DTO classes', () => {
    class AnotherDto {
      title: string;
    }

    const SchemaClass = createPaginatedResponseDto(AnotherDto);
    expect(SchemaClass.name).toBe('PaginatedAnotherDtoResponse');
  });
});
