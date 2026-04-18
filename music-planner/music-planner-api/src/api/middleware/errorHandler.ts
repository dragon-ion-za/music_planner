import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from 'express-oauth2-jwt-bearer';
import { UniqueConstraintError } from 'sequelize';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({ error: 'Service already exists' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
