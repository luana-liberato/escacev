import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { PositionCompatibilityController } from '../controllers/PositionCompatibilityController';

/**
 * Matriz de compatibilidade entre funções (RN01/RN02).
 *
 * RBAC: escrita E leitura são abertas ao ADMIN_GERAL e ao ADMIN_MINISTERIO
 * (decisão da cliente, jul/2026). O MEMBRO fica de fora pelo próprio rbac.
 *
 * A matriz é escopo de INSTITUIÇÃO, não de ministério — um par pode ligar funções
 * de ministérios diferentes, então NÃO há um ministério único para escopar com a
 * MinistryAccessPolicy. Por isso o ADMIN_MINISTERIO recebe acesso PLENO (todas as
 * funções, qualquer par), sem checagem escopada: é um afrouxamento consciente do
 * RBAC (ver a nota na Fase 3 do TASKS.md e o comentário nos use cases).
 *
 * ATENÇÃO À ORDEM: estas rotas precisam ser montadas ANTES de `positionRoutes` no
 * index.ts. Caso contrário, `DELETE /funcoes/compatibilidade` seria capturado por
 * `DELETE /funcoes/:id` (com :id = "compatibilidade").
 */
export const compatibilityRoutes = Router();
const controller = new PositionCompatibilityController();

// Marcar par como compatível — body { positionAId, positionBId }.
compatibilityRoutes.post(
  '/funcoes/compatibilidade',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.create),
);

// Remover a compatibilidade de um par — query ?positionAId=..&positionBId=..
compatibilityRoutes.delete(
  '/funcoes/compatibilidade',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);

// Listar os pares compatíveis da instituição.
compatibilityRoutes.get(
  '/funcoes/compatibilidade',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.list),
);
