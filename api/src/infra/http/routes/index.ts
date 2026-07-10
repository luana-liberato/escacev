import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { memberRoutes } from './member.routes';
import { ministryRoutes } from './ministry.routes';
import { membershipRoutes } from './membership.routes';
import { compatibilityRoutes } from './compatibility.routes';
import { positionRoutes } from './position.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(memberRoutes);
routes.use(ministryRoutes);
routes.use(membershipRoutes);
// Antes de positionRoutes: /funcoes/compatibilidade não pode ser capturado por /funcoes/:id.
routes.use(compatibilityRoutes);
routes.use(positionRoutes);
