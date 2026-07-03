import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { MinistryController } from '../controllers/MinistryController';

export const ministryRoutes = Router();
const controller = new MinistryController();

// Criar ministério — apenas ADMIN_GERAL.
ministryRoutes.post(
  '/ministerios',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.create),
);

// Listar ministérios — ADMIN_GERAL e ADMIN_MINISTERIO.
ministryRoutes.get(
  '/ministerios',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.list),
);

// Buscar um ministério — ADMIN_GERAL e ADMIN_MINISTERIO.
ministryRoutes.get(
  '/ministerios/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.show),
);

// Atualizar ministério — apenas ADMIN_GERAL.
// A edição escopada pelo ADMIN_MINISTERIO (isAdmin no vínculo) entra num bloco futuro.
ministryRoutes.put(
  '/ministerios/:id',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.update),
);

// Remover ministério — apenas ADMIN_GERAL (bloqueado se houver dependências).
ministryRoutes.delete(
  '/ministerios/:id',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.remove),
);
