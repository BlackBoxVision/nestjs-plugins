import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrors } from './api-response';

interface ExceptionResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errors: ApiErrors = { _general: ['Internal server error'] };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errors = { _general: [exceptionResponse] };
      } else {
        const body = exceptionResponse as ExceptionResponseBody;
        const messages = body.message;

        if (Array.isArray(messages)) {
          errors = this.parseValidationErrors(messages);
        } else {
          errors = { _general: [messages ?? exception.message] };
        }
      }
    } else if (exception instanceof Error) {
      errors = { _general: [exception.message] };
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      success: false,
      data: null,
      errors,
    });
  }

  private parseValidationErrors(messages: string[]): ApiErrors {
    const errors: ApiErrors = {};

    for (const msg of messages) {
      const match = msg.match(/^(\w+)\s+(.+)$/);
      if (match && match[1] && match[2]) {
        const field = match[1];
        const message = match[2];
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(message);
      } else {
        if (!errors['_general']) {
          errors['_general'] = [];
        }
        errors['_general'].push(msg);
      }
    }

    if (Object.keys(errors).length === 0) {
      return { _general: messages.length > 0 ? messages : ['Validation error'] };
    }

    return errors;
  }
}
