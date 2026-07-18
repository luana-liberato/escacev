import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { PositionController } from '../controllers/PositionController';

/**
 * Funções (Position) dentro de um ministério.
 *
 * RBAC: as ESCRITAS (criar, editar, remover) são escopo de ministério — o rbac
 * é o filtro grosso (ADMIN_GERAL + ADMIN_MINISTERIO, bloqueia MEMBRO) e a guarda
 * MinistryAccessPolicy faz a checagem fina no use case (ADMIN_MINISTERIO só age
 * onde tem isAdmin; senão 403). A LEITURA não é escopada: qualquer admin lista.
 */
export const positionRoutes = Router();
const controller = new PositionController();

// Criar função no ministério :id — ADMIN_GERAL ou admin escopado (guarda no use case).
positionRoutes.post(
  '/ministerios/:id/funcoes',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.create),
);

// Listar funções do ministério :id — ADMIN_GERAL e ADMIN_MINISTERIO (leitura não escopada).
positionRoutes.get(
  '/ministerios/:id/funcoes',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.list),
);

// Catálogo de TODAS as funções da instituição (com nome do ministério) — insumo
// da tela de Funções e dos toggles de compatibilidade. Leitura não escopada:
// ADMIN_GERAL e ADMIN_MINISTERIO. Path exato, não colide com /funcoes/:id.
positionRoutes.get(
  '/funcoes',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.listAll),
);

// Editar função — ADMIN_GERAL ou admin escopado do ministério da função (guarda no use case).
positionRoutes.put(
  '/funcoes/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.update),
);

// Remover função — ADMIN_GERAL ou admin escopado; 409 se em uso em escalas/alocações.
positionRoutes.delete(
  '/funcoes/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);
