import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { ScheduleController } from '../controllers/ScheduleController';

/**
 * Escalas (Schedule) — a "casca" da escala de um ministério para um evento.
 *
 * RBAC: as ESCRITAS (criar, publicar, remover) são escopo de ministério — o rbac é
 * o filtro grosso (ADMIN_GERAL + ADMIN_MINISTERIO, bloqueia MEMBRO) e a guarda
 * MinistryAccessPolicy faz a checagem fina no use case (403 fora do escopo).
 *
 * A LEITURA (listar, ver, conflitos) é aberta a TODOS os autenticados, mas o
 * ESCOPO é aplicado NO USE CASE por papel: admin vê tudo (visão do evento,
 * inclusive de outros ministérios); o MEMBRO vê só escalas PUBLICADA de
 * ministérios em que participa (RN04) — senão 404. (GET /minhas-escalas segue como
 * a agenda pessoal achatada do membro.)
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

// Listar escalas (filtros ?eventId= e ?ministryId=) — qualquer autenticado; o use
// case escopa o MEMBRO (só publicadas de ministério que participa).
scheduleRoutes.get(
  '/escalas',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO', 'MEMBRO'),
  asyncHandler(controller.list),
);

// Ver uma escala — qualquer autenticado; o MEMBRO só alcança publicada de
// ministério que participa (senão 404, no use case).
scheduleRoutes.get(
  '/escalas/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO', 'MEMBRO'),
  asyncHandler(controller.show),
);

// Conflitos da escala (reavaliação ao vivo, read-only) — qualquer autenticado;
// mesmo escopo de MEMBRO do GET /escalas/:id.
scheduleRoutes.get(
  '/escalas/:id/conflitos',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO', 'MEMBRO'),
  asyncHandler(controller.conflicts),
);

// Publicar escala (RASCUNHO -> PUBLICADA, RN04) — ADMIN_GERAL ou admin escopado (guarda no use case).
scheduleRoutes.patch(
  '/escalas/:id/publicar',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.publish),
);

// Remover escala — ADMIN_GERAL ou admin escopado do ministério (guarda no use case).
scheduleRoutes.delete(
  '/escalas/:id',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.remove),
);
