import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { rbac } from '../middlewares/rbac';
import { UnavailabilityController } from '../controllers/UnavailabilityController';

/**
 * Indisponibilidade (Unavailability) — o membro registra/lista/remove os
 * próprios períodos indisponíveis (RN05). Essas são member-scoped: só `auth`, sem
 * `rbac` — qualquer perfil autenticado (inclusive MEMBRO) age sobre os PRÓPRIOS
 * dados; o memberId vem do JWT e os use cases validam a posse.
 *
 * A exceção é a consulta do ADMIN às indisponibilidades de um membro (ao montar a
 * escala): essa usa `rbac` (só admins) e valida o tenant no use case.
 */
export const unavailabilityRoutes = Router();
const controller = new UnavailabilityController();

unavailabilityRoutes.post('/indisponibilidades', auth, asyncHandler(controller.create));

unavailabilityRoutes.get('/indisponibilidades/minhas', auth, asyncHandler(controller.listMine));

unavailabilityRoutes.delete('/indisponibilidades/:id', auth, asyncHandler(controller.remove));

// Consulta do admin: indisponibilidades de um membro (ao montar a escala, RN05).
unavailabilityRoutes.get(
  '/membros/:id/indisponibilidades',
  auth,
  rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'),
  asyncHandler(controller.listForMember),
);
