import { Request, Response } from 'express';
import { respond } from '../../../shared/utils/respond';

export class HealthController {
  handle = async (_req: Request, res: Response): Promise<void> => {
    respond(res, 200, { status: 'ok' }, 'API no ar');
  };
}
