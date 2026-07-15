import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { memberRoutes } from './member.routes';
import { ministryRoutes } from './ministry.routes';
import { membershipRoutes } from './membership.routes';
import { compatibilityRoutes } from './compatibility.routes';
import { positionRoutes } from './position.routes';
import { eventRoutes } from './event.routes';
import { scheduleRoutes } from './schedule.routes';
import { myScheduleRoutes } from './mySchedule.routes';
import { assignmentRoutes } from './assignment.routes';
import { unavailabilityRoutes } from './unavailability.routes';
import { notificationRoutes } from './notification.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(memberRoutes);
routes.use(ministryRoutes);
routes.use(membershipRoutes);
// Antes de positionRoutes: /funcoes/compatibilidade não pode ser capturado por /funcoes/:id.
routes.use(compatibilityRoutes);
routes.use(positionRoutes);
routes.use(eventRoutes);
routes.use(scheduleRoutes);
routes.use(myScheduleRoutes);
routes.use(assignmentRoutes);
routes.use(unavailabilityRoutes);
routes.use(notificationRoutes);
