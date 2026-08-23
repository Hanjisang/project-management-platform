import type { Request } from 'express';

export interface RequestUser {
  id: string;
  username: string;
  displayName: string;
  permissions: string[];
  isAdministrator: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  requestId: string;
}

export interface RequestWithId extends Request {
  requestId: string;
}
