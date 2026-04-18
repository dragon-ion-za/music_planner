import { Request, Response, NextFunction } from 'express';

const CONGREGATION_CLAIM = 'https://music-planner.app/congregation_id';

export function extractClaims(req: Request, res: Response, next: NextFunction): void {
  const congregationId = req.auth?.payload[CONGREGATION_CLAIM] as string | undefined;
  if (!congregationId) {
    res.status(403).json({ error: 'Missing congregation_id claim in token' });
    return;
  }
  req.congregationId = congregationId;
  next();
}
