// ─── Base ─────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errors: { field: string; message: string }[] = []
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── HTTP Errors ──────────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    fieldErrors?: Record<string, string[]>
  ) {
    const errors = fieldErrors
      ? Object.entries(fieldErrors).flatMap(([field, msgs]) =>
          msgs.map((msg) => ({ field, message: msg }))
        )
      : [];
    super(message, 422, errors);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
    this.name = "BadRequestError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.") {
    super(message, 429);
    this.name = "TooManyRequestsError";
  }
}
