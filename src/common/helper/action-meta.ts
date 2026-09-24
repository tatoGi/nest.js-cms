import { Request } from 'express';

export interface ActionMeta {
  actorId?: number;
  ip?: string;
}

export function getMeta(req: Request): ActionMeta {
  const user = (req as any).user as any;
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return { actorId: user?.userId, ip };
}
