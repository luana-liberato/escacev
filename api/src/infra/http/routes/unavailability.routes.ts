import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { UnavailabilityController } from '../controllers/UnavailabilityController';

/**
 * Indisponibilidade (Unavailability) — o membro registra/lista/remove os
 * próprios períodos indisponíveis (RN05). É member-scoped: só `auth`, sem
 * `rbac` — qualquer perfil autenticado (inclusive MEMBRO) age sobre os PRÓPRIOS
 * dados; o memberId vem do JWT e os use cases validam a posse.
 */
export const unavailabilityRoutes = Router();
const controller = new UnavailabilityController();

unavailabilityRoutes.post('/indisponibilidades', auth, asyncHandler(controller.create));

unavailabilityRoutes.get('/indisponibilidades/minhas', auth, asyncHandler(controller.listMine));

unavailabilityRoutes.delete('/indisponibilidades/:id', auth, asyncHandler(controller.remove));
