import { Request } from 'express';
import { JwtUser } from './jwt-user.interface';

export interface AuthRequest extends Request {
  user: JwtUser;
}
