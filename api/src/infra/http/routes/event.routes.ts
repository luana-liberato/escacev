import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { EventController } from '../controllers/EventController';

/**
 * Eventos (Event) — calendário da instituição (modelo de alocação direta, sem
 * "vagas"). RBAC: evento é escopo de INSTITUIÇÃO, não de ministério — rbac de
 * rota puro, sem MinistryAccessPolicy. Todas as ações (criar/listar/ver/editar/
 * remover) são liberadas aos dois admins (ADMIN_GERAL e ADMIN_MINISTERIO).
 * Nota: editar horário ou remover um evento afeta escalas que outros ministérios
 * já montaram sobre ele — é uma consequência aceita pela decisão de produto de
 * deixar qualquer admin gerir o calendário.
 */
export const eventRoutes = Router();
const controller = new EventController();

eventRoutes.post(
  '/eventos',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.create),
);

eventRoutes.get(
  '/eventos',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.list),
);

eventRoutes.get(
  '/eventos/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.get),
);

// Editar — os dois admins; 400 se o intervalo ficar inválido (ver UpdateEventUseCase).
eventRoutes.put(
  '/eventos/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.update),
);

// Remover — os dois admins; 409 se houver escalas vinculadas (ver DeleteEventUseCase).
eventRoutes.delete(
  '/eventos/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);
