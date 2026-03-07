export type ApiErrors = Record<string, string[]>;

export class ApiResponse<T> {
  success: boolean;
  data: T | null;
  errors: ApiErrors | null;

  constructor(success: boolean, data: T | null, errors: ApiErrors | null) {
    this.success = success;
    this.data = data;
    this.errors = errors;
  }

  static ok<T>(data: T): ApiResponse<T> {
    return new ApiResponse(true, data, null);
  }

  static error(errors: ApiErrors): ApiResponse<null> {
    return new ApiResponse(false, null, errors);
  }
}

export class PaginatedApiResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    super(true, data, null);
    this.total = total;
    this.page = page;
    this.limit = limit;
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedApiResponse<T> {
    return new PaginatedApiResponse(data, total, page, limit);
  }
}
