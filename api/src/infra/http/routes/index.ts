import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { memberRoutes } from './member.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(memberRoutes);
