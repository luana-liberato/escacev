import { Router } from 'express';
import { healthRoutes } from './health.routes';

export const routes = Router();

routes.use(healthRoutes);
