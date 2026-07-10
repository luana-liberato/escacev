import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { EventController } from '../controllers/EventController';

/**
 * Eventos (Event) — calendário da instituição (modelo de alocação direta, sem
 * "vagas"). RBAC: evento é escopo de INSTITUIÇÃO, não de ministério — rbac de
 * rota puro, sem MinistryAccessPolicy. Criar/listar/ver: qualquer admin
 * (conveniência de agendar). Editar/remover: só ADMIN_GERAL — mudar horário ou
 * apagar afeta escalas que outros ministérios já montaram sobre o evento.
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

// Editar — SÓ ADMIN_GERAL: mudar horário do evento afeta escalas de outros ministérios.
eventRoutes.put(
  '/eventos/:id',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.update),
);

// Remover — SÓ ADMIN_GERAL; 409 se houver escalas vinculadas (ver DeleteEventUseCase).
eventRoutes.delete(
  '/eventos/:id',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.remove),
);
