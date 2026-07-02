import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { MemberController } from '../controllers/MemberController';

export const memberRoutes = Router();
const controller = new MemberController();

// Criar (convidar) membro — ADMIN_GERAL e ADMIN_MINISTERIO.
memberRoutes.post(
  '/membros',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.create),
);

// Listar membros — ADMIN_GERAL e ADMIN_MINISTERIO.
memberRoutes.get(
  '/membros',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.list),
);

// Buscar um membro — ADMIN_GERAL e ADMIN_MINISTERIO.
memberRoutes.get(
  '/membros/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.show),
);

// Atualizar membro — apenas ADMIN_GERAL.
memberRoutes.put(
  '/membros/:id',
  auth,
  rbac('ADMIN_GERAL'),
  asyncHandler(controller.update),
);

// Desativar membro (soft delete) — ADMIN_GERAL e ADMIN_MINISTERIO.
memberRoutes.delete(
  '/membros/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);
