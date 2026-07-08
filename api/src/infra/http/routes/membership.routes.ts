import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { MinistryMembershipController } from '../controllers/MinistryMembershipController';

/**
 * Vínculo Membro↔Ministério (associação, convite, papel de admin escopado).
 *
 * RBAC deste bloco: toda ESCRITA (associar, convidar, promover/rebaixar, remover)
 * fica restrita ao ADMIN_GERAL por enquanto. A permissão escopada do
 * ADMIN_MINISTERIO (agir sobre o ministério onde tem isAdmin) entra no Bloco 4,
 * pela guarda reutilizável "é admin deste ministério" — os endpoints de escrita
 * abaixo serão então abertos ao ADMIN_MINISTERIO.
 */
export const membershipRoutes = Router();
const controller = new MinistryMembershipController();

// Associar membro existente — escrita: apenas ADMIN_GERAL (ver nota / Bloco 4).
membershipRoutes.post(
  '/ministerios/:id/membros',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.associate),
);

// Convidar (criar-ou-associar) — escrita: apenas ADMIN_GERAL (ver nota / Bloco 4).
membershipRoutes.post(
  '/ministerios/:id/membros/convite',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.invite),
);

// Promover/rebaixar admin do ministério — escrita: apenas ADMIN_GERAL (ver nota / Bloco 4).
membershipRoutes.patch(
  '/ministerios/:id/membros/:membroId/admin',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.setAdmin),
);

// Remover associação — escrita: apenas ADMIN_GERAL (ver nota / Bloco 4).
membershipRoutes.delete(
  '/ministerios/:id/membros/:membroId',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.remove),
);

// Listar membros do ministério (com isAdmin) — ADMIN_GERAL e ADMIN_MINISTERIO.
membershipRoutes.get(
  '/ministerios/:id/membros',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.listMembers),
);

// Listar ministérios do membro (com isAdmin) — ADMIN_GERAL e ADMIN_MINISTERIO.
membershipRoutes.get(
  '/membros/:id/ministerios',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.listMinistries),
);
