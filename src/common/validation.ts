import { ValidationPipe } from '@nestjs/common';

/**
 * Request validation settings shared by the application bootstrap and the
 * e2e tests, so the tests exercise exactly the rules production runs with.
 *
 * - whitelist / forbidNonWhitelisted: unknown properties are a 400, not
 *   silently dropped, so a mistyped field name is caught at the edge.
 * - transform: the controller receives a real DTO instance with the
 *   declared types (e.g. numeric strings coerced where @Type says so).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}
