export type ErrorDetails = Record<string, string[]>;

/** An error that maps directly onto an HTTP response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: ErrorDetails) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }
  static validation(message: string, details?: ErrorDetails) {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Please log in to continue.') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to do that.') {
    return new HttpError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Not found.') {
    return new HttpError(404, 'NOT_FOUND', message);
  }
  /** The request is valid but conflicts with the resource's current state (e.g. editing a submitted voucher). */
  static conflict(message: string) {
    return new HttpError(409, 'INVALID_STATE', message);
  }
}
