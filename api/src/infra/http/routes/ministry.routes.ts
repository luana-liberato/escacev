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

/**
 * Read model da tela de Ministérios (cards), escopado por papel — `auth`-only,
 * porque o MEMBRO também vê a tela (só os ministérios dele). O escopo é decidido
 * no use case, não pelo rbac.
 *
 * DEVE vir ANTES de '/ministerios/:id': o Express casa na ordem, e o `:id`
 * capturaria "cards" (mesmo cuidado de '/membros/me' e '/funcoes/compatibilidade').
 */
ministryRoutes.get('/ministerios/cards', auth, asyncHandler(controller.listCards));

// Buscar um ministério — ADMIN_GERAL e ADMIN_MINISTERIO.
ministryRoutes.get(
  '/ministerios/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.show),
);

// Atualizar ministério — ADMIN_GERAL ou ADMIN_MINISTERIO com isAdmin naquele
// ministério. O rbac é o filtro grosso (bloqueia MEMBRO); a guarda escopada
// (MinistryAccessPolicy) faz a checagem fina no use case e responde 403.
ministryRoutes.put(
  '/ministerios/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.update),
);

// Remover ministério — apenas ADMIN_GERAL (bloqueado se houver dependências).
ministryRoutes.delete(
  '/ministerios/:id',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.remove),
);
