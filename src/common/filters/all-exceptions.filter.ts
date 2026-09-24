// src/common/filters/all-exceptions.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ErrorCodes } from '../exceptions/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract errorCode, message, details from AppException or plain HttpException
    let errorCode: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: unknown = null;

    if (exception instanceof AppException) {
      const res = exception.getResponse() as any;
      errorCode = res.errorCode ?? ErrorCodes.INTERNAL_ERROR;
      message = res.message ?? exception.message;
      details = res.details ?? null;
    } else if (exception instanceof HttpException) {
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorCode = this.statusToCode(status);
      } else if (typeof res === 'object' && res !== null) {
        const r = res as any;

        // Validation errors from ValidationPipe arrive as array in message
        if (Array.isArray(r.message)) {
          errorCode = ErrorCodes.VALIDATION_ERROR;
          message = 'Validation failed';
          details = r.message;
        } else if (r.errorCode) {
          errorCode = r.errorCode;
          message = r.message ?? exception.message;
          details = r.details ?? null;
        } else {
          message = r.message ?? exception.message;
          errorCode = this.statusToCode(status);
        }
      }
    }

    const isDev = process.env.NODE_ENV !== 'production';

    this.logger.error(
      `[${errorCode}] ${request.method} ${request.url} → ${status}`,
      isDev && exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      success: false,
      errorCode,
      statusCode: status,
      message,
      details,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      ...(isDev && exception instanceof Error ? { stack: exception.stack } : {}),
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      408: 'REQUEST_TIMEOUT',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}
