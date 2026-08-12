import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { UnauthorizedError } from '../../errors/application.error';
import { ListUsersQuery } from './users.schemas';

export const listUsersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const query = req.query as unknown as ListUsersQuery;
    const result = await usersService.listUsers(query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await usersService.getUser(req.params.userId);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const createUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth?.user) {
      throw new UnauthorizedError('Unauthorized');
    }

    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = req.id as string;

    const user = await usersService.provisionUser({
      ...req.body,
      actorUserId: req.auth.user.id,
      ipAddress,
      userAgent,
      requestId,
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUserRoleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth?.user) {
      throw new UnauthorizedError('Unauthorized');
    }

    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = req.id as string;

    const user = await usersService.updateUserRole({
      targetUserId: req.params.userId,
      newRole: req.body.role,
      actorUserId: req.auth.user.id,
      ipAddress,
      userAgent,
      requestId,
    });

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
