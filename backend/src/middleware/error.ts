import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

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

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const requestId = `req-${Date.now()}`;
  console.error('ERROR CAUGHT:', err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
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
