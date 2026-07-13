import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { AssignmentController } from '../controllers/AssignmentController';

/**
 * Alocações (Assignment) — pessoa + função dentro da escala de um ministério.
 *
 * RBAC: o rbac é só o filtro grosso (ADMIN_GERAL + ADMIN_MINISTERIO, bloqueia
 * MEMBRO); a checagem fina (é admin DESTE ministério?) já é feita DENTRO dos use
 * cases via MinistryAccessPolicy.ensureCanManage — não duplicada aqui.
 */
export const assignmentRoutes = Router();
const controller = new AssignmentController();

// Adiciona um lote (array) de alocações à escala :id.
assignmentRoutes.post(
  '/escalas/:id/alocacoes',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.add),
);

// Edição unitária: troca memberId e/ou positionId de uma alocação.
assignmentRoutes.patch(
  '/alocacoes/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.update),
);

// Remove uma alocação.
assignmentRoutes.delete(
  '/alocacoes/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);
