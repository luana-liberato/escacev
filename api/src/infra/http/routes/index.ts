import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
