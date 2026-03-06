export class ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;

  constructor(data: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static ok<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse(data, message);
  }

  static error<T = null>(message: string, data?: T): ApiResponse<T | null> {
    const response = new ApiResponse<T | null>(data ?? null, message);
    response.success = false;
    return response;
  }
}
