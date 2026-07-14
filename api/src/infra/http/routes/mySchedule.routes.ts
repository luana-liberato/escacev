import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { auth } from '../middlewares/auth';
import { MyScheduleController } from '../controllers/MyScheduleController';

/**
 * Visão do MEMBRO (GET /minhas-escalas) — a agenda do próprio usuário, só de
 * escalas PUBLICADA (RN04). Diferente das rotas de /escalas (admin), esta é
 * aberta a QUALQUER usuário autenticado: só `auth`, sem rbac. O memberId vem do
 * JWT, então cada um só enxerga as suas próprias alocações.
 */
export const myScheduleRoutes = Router();
const controller = new MyScheduleController();

// Minhas escalas do período (?from&?to opcionais; mês corrente por padrão).
myScheduleRoutes.get('/minhas-escalas', auth, asyncHandler(controller.list));
