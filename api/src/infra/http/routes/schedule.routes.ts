import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { ScheduleController } from '../controllers/ScheduleController';

/**
 * Escalas (Schedule) — a "casca" da escala de um ministério para um evento.
 *
 * RBAC: as ESCRITAS (criar, remover) são escopo de ministério — o rbac é o filtro
 * grosso (ADMIN_GERAL + ADMIN_MINISTERIO, bloqueia MEMBRO) e a guarda
 * MinistryAccessPolicy faz a checagem fina no use case (ADMIN_MINISTERIO só age no
 * ministério onde tem isAdmin; senão 403). A LEITURA (listar, ver) não é escopada:
 * qualquer admin vê as escalas — inclusive as de outros ministérios (visão do
 * evento). A visão do MEMBRO é outro fluxo (GET /minhas-escalas, Fase 5), restrito
 * a escalas PUBLICADAS onde ele está alocado (RN04).
 */
export const scheduleRoutes = Router();
const controller = new ScheduleController();

// Criar escala — ADMIN_GERAL ou admin escopado do ministério (guarda no use case).
scheduleRoutes.post(
  '/escalas',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.create),
);

// Listar escalas (filtros ?eventId= e ?ministryId=) — ADMIN_GERAL e ADMIN_MINISTERIO.
scheduleRoutes.get(
  '/escalas',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.list),
);

// Ver uma escala — ADMIN_GERAL e ADMIN_MINISTERIO (leitura aberta).
scheduleRoutes.get(
  '/escalas/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.show),
);

// Remover escala — ADMIN_GERAL ou admin escopado do ministério (guarda no use case).
scheduleRoutes.delete(
  '/escalas/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);
