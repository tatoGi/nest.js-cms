import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCodes } from './error-codes';

// ── Not Found ────────────────────────────────────────────────

export class ResourceNotFoundException extends AppException {
  constructor(resource: string, id: string | number) {
    super(
      ErrorCodes.RECORD_NOT_FOUND as any,
      `${resource} with ID ${id} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PostNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.POST_NOT_FOUND,
      typeof id === 'number' ? `Post with ID ${id} not found` : `Post with slug "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PageNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.PAGE_NOT_FOUND,
      typeof id === 'number' ? `Page with ID ${id} not found` : `Page with slug "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MenuNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.MENU_NOT_FOUND,
      typeof id === 'number' ? `Menu with ID ${id} not found` : `Menu with slug "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MenuItemNotFoundException extends AppException {
  constructor(id: number) {
    super(
      ErrorCodes.MENU_ITEM_NOT_FOUND,
      `Menu item with ID ${id} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MediaNotFoundException extends AppException {
  constructor(id: number) {
    super(ErrorCodes.MEDIA_NOT_FOUND, `Media with ID ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

export class MediaFileNotFoundException extends AppException {
  constructor(path: string) {
    super(ErrorCodes.MEDIA_FILE_NOT_FOUND, `File not found on disk: ${path}`, HttpStatus.NOT_FOUND);
  }
}

export class LanguageNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.LANGUAGE_NOT_FOUND,
      typeof id === 'number'
        ? `Language with ID ${id} not found`
        : `Language with code "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BlockTypeNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.BLOCK_TYPE_NOT_FOUND,
      typeof id === 'number'
        ? `Block type with ID ${id} not found`
        : `Block type with key "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PageTemplateNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.PAGE_TEMPLATE_NOT_FOUND,
      typeof id === 'number'
        ? `Page template with ID ${id} not found`
        : `Page template with slug "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

// ── Conflict ─────────────────────────────────────────────────

export class PostDuplicateException extends AppException {
  constructor(slug: string) {
    super(
      ErrorCodes.POST_DUPLICATE,
      `Post with slug "${slug}" already exists for this language`,
      HttpStatus.CONFLICT,
    );
  }
}

export class MenuDuplicateException extends AppException {
  constructor(slug: string) {
    super(
      ErrorCodes.MENU_DUPLICATE,
      `Menu with slug "${slug}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class LanguageDuplicateException extends AppException {
  constructor(code: string) {
    super(
      ErrorCodes.LANGUAGE_DUPLICATE,
      `Language with code "${code}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class BlockTypeDuplicateException extends AppException {
  constructor(key: string) {
    super(
      ErrorCodes.BLOCK_TYPE_DUPLICATE,
      `Block type with key "${key}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class PageTemplateDuplicateException extends AppException {
  constructor(slug: string) {
    super(
      ErrorCodes.PAGE_TEMPLATE_DUPLICATE,
      `Page template with slug "${slug}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class SettingsNotFoundException extends AppException {
  constructor(id: number) {
    super(ErrorCodes.SETTINGS_NOT_FOUND, `Setting with ID ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

export class SettingsDuplicateException extends AppException {
  constructor(key: string) {
    super(
      ErrorCodes.UNIQUE_CONSTRAINT,
      `Setting with key "${key}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class PostCategoryNotFoundException extends AppException {
  constructor(id: number | string) {
    super(
      ErrorCodes.RECORD_NOT_FOUND,
      typeof id === 'number'
        ? `Post category with ID ${id} not found`
        : `Post category with slug "${id}" not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PostCategoryDuplicateException extends AppException {
  constructor(slug: string) {
    super(
      ErrorCodes.UNIQUE_CONSTRAINT,
      `Post category with slug "${slug}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class UserNotFoundException extends AppException {
  constructor(id?: number) {
    super(
      ErrorCodes.RECORD_NOT_FOUND,
      id ? `User with ID ${id} not found` : 'User not found',
      HttpStatus.NOT_FOUND,
    );
  }
}

// ── Auth ─────────────────────────────────────────────────────

export class InvalidCredentialsException extends AppException {
  constructor() {
    super(ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials', HttpStatus.UNAUTHORIZED);
  }
}

export class AccountDeactivatedException extends AppException {
  constructor() {
    super(ErrorCodes.ACCOUNT_DEACTIVATED, 'Account is deactivated', HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidRefreshTokenException extends AppException {
  constructor() {
    super(ErrorCodes.TOKEN_EXPIRED, 'Invalid or expired refresh token', HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidResetTokenException extends AppException {
  constructor() {
    super(
      ErrorCodes.PASSWORD_RESET_TOKEN_INVALID,
      'Invalid or expired password reset token',
      HttpStatus.BAD_REQUEST,
    );
  }
}

// ── Bad Request ──────────────────────────────────────────────

export class InvalidBulkActionException extends AppException {
  constructor(action: string) {
    super(
      ErrorCodes.INVALID_BULK_ACTION,
      `Unknown bulk action: "${action}"`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidSchemaException extends AppException {
  constructor(reason: string) {
    super(ErrorCodes.INVALID_SCHEMA, reason, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidFileException extends AppException {
  constructor(reason: string) {
    super(ErrorCodes.INVALID_FILE, reason, HttpStatus.BAD_REQUEST);
  }
}
