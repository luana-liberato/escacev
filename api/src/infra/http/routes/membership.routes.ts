import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { MinistryMembershipController } from '../controllers/MinistryMembershipController';

/**
 * Vínculo Membro↔Ministério (associação, convite, papel de admin escopado).
 *
 * RBAC deste bloco: o rbac libera ADMIN_GERAL e ADMIN_MINISTERIO (filtro grosso,
 * bloqueia MEMBRO) e a guarda reutilizável MinistryAccessPolicy faz a checagem
 * fina no use case — o ADMIN_MINISTERIO só age no ministério onde tem isAdmin,
 * respondendo 403 caso contrário.
 */
export const membershipRoutes = Router();
const controller = new MinistryMembershipController();

// Associar membro existente — ADMIN_GERAL ou admin escopado (guarda no use case).
membershipRoutes.post(
  '/ministerios/:id/membros',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.associate),
);

// Convidar (criar-ou-associar) — ADMIN_GERAL ou admin escopado (guarda no use case).
membershipRoutes.post(
  '/ministerios/:id/membros/convite',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.invite),
);

// Promover/rebaixar admin do ministério — ADMIN_GERAL ou admin escopado (guarda no use case).
membershipRoutes.patch(
  '/ministerios/:id/membros/:membroId/admin',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.setAdmin),
);

// Remover associação — ADMIN_GERAL ou admin escopado (guarda no use case).
membershipRoutes.delete(
  '/ministerios/:id/membros/:membroId',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
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

/**
 * Define os ministérios do membro como EXATAMENTE a lista recebida — o "salvar"
 * dos chips do modal de edição.
 *
 * ADMIN_GERAL apenas, e aqui o rbac é a checagem FINAL, não um filtro grosso:
 * mexer nos ministérios de alguém ATRAVESSA ministérios, então é escopo de
 * INSTITUIÇÃO (Seção 1 do CLAUDE.md). Um ADMIN_MINISTERIO não pode tirar ninguém
 * de um ministério que ele não administra — e como não há um ministério único
 * para escopar, não existe MinistryAccessPolicy a aplicar no use case.
 */
membershipRoutes.put(
  '/membros/:id/ministerios',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.setMinistries),
);
