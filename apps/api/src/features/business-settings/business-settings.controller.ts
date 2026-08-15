import { Request, Response, NextFunction } from 'express';
import * as service from './business-settings.service';
import { UnauthorizedError } from '../../errors/application.error';
import { BusinessSettingsUpdatePayload } from './business-settings.types';

export const getBusinessSettingsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const settings = await service.getBusinessSettings();
    res.status(200).json({ settings });
  } catch (error) {
    next(error);
  }
};

export const updateBusinessSettingsHandler = async (
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
    const payload = req.body as BusinessSettingsUpdatePayload;

    const { settings, created } = await service.updateBusinessSettings({
      payload,
      actorUserId: req.auth.user.id,
      ipAddress,
      userAgent,
      requestId,
    });

    if (created) {
      res.status(201).json({ settings });
    } else {
      res.status(200).json({ settings });
    }
  } catch (error) {
    next(error);
  }
};
