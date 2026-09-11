import { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 doesn't catch rejected promises from async route handlers on
// its own — this wraps one so a thrown ApiError (or anything else) always
// reaches errorHandler instead of crashing the process.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
