import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { HealthController } from '../controllers/HealthController';

export const healthRoutes = Router();
const controller = new HealthController();

healthRoutes.get('/health', asyncHandler(controller.handle));
