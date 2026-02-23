import type { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const requestId = `req-${Date.now()}`;

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Unexpected error',
    timestamp: new Date().toISOString(),
    requestId,
  });
}
