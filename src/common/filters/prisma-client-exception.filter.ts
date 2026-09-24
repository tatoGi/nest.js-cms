// src/common/filters/prisma-client-exception.filter.ts

import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';
import { ErrorCodes } from '../exceptions/error-codes';

interface PrismaErrorMapping {
  status: HttpStatus;
  errorCode: string;
  message: string | ((meta: Record<string, unknown>) => string);
}

const PRISMA_ERROR_MAP: Record<string, PrismaErrorMapping> = {
  P2000: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: ErrorCodes.VALUE_TOO_LONG,
    message: 'The provided value is too long for the field',
  },
  P2001: {
    status: HttpStatus.NOT_FOUND,
    errorCode: ErrorCodes.RECORD_NOT_FOUND,
    message: 'Record not found',
  },
  P2002: {
    status: HttpStatus.CONFLICT,
    errorCode: ErrorCodes.UNIQUE_CONSTRAINT,
    message: (meta) => {
      const target = (meta?.target as string[]) ?? [];
      return `Duplicate value for: ${target.join(', ')}`;
    },
  },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: ErrorCodes.FOREIGN_KEY_VIOLATION,
    message: 'Foreign key constraint failed — related record not found',
  },
  P2014: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: ErrorCodes.RELATION_VIOLATION,
    message: 'Relation constraint violated',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    errorCode: ErrorCodes.RECORD_NOT_FOUND,
    message: 'Record not found',
  },
  P2024: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    errorCode: ErrorCodes.DB_TIMEOUT,
    message: 'Database connection timeout — please try again',
  },
  P2034: {
    status: HttpStatus.CONFLICT,
    errorCode: ErrorCodes.DB_TRANSACTION_CONFLICT,
    message: 'Transaction write conflict — please retry the operation',
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  override catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapping = PRISMA_ERROR_MAP[exception.code];

    this.logger.error(
      `[${mapping?.errorCode ?? 'PRISMA_ERROR'}] Prisma ${exception.code} → ${request.method} ${request.url}`,
      JSON.stringify(exception.meta),
    );

    if (!mapping) {
      super.catch(exception, host);
      return;
    }

    const meta = (exception.meta ?? {}) as Record<string, unknown>;
    const message = typeof mapping.message === 'function' ? mapping.message(meta) : mapping.message;

    response.status(mapping.status).json({
      success: false,
      errorCode: mapping.errorCode,
      statusCode: mapping.status,
      message,
      details: null,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    });
  }
}
