import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { memberRoutes } from './member.routes';
import { ministryRoutes } from './ministry.routes';
import { membershipRoutes } from './membership.routes';
import { positionRoutes } from './position.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(memberRoutes);
routes.use(ministryRoutes);
routes.use(membershipRoutes);
routes.use(positionRoutes);
