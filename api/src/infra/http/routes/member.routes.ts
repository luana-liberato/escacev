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

/**
 * Os PRÓPRIOS dados do usuário autenticado — member-scoped: só `auth`, sem
 * `rbac`. Todo perfil precisa se enxergar (nome, e-mail), e o `GET /membros/:id`
 * abaixo exige admin. O id vem do JWT, então ninguém lê cadastro alheio aqui.
 *
 * DEVE vir ANTES de '/membros/:id': o Express casa na ordem de registro, e o
 * `:id` capturaria "me" — o rbac então bloquearia o MEMBRO com 403. Mesmo cuidado
 * de '/funcoes/compatibilidade' antes de '/funcoes/:id' (ver routes/index.ts).
 */
memberRoutes.get('/membros/me', auth, asyncHandler(controller.showMe));

/**
 * O usuário corrige o PRÓPRIO nome — qualquer perfil, sem `rbac`. O nome do
 * cadastro é o que o admin digitou no convite; sem esta rota, quem foi cadastrado
 * errado dependeria de um ADMIN_GERAL para se corrigir.
 *
 * Também ANTES de '/membros/:id' — o PUT lá é exclusivo do ADMIN_GERAL e
 * capturaria "me".
 */
memberRoutes.patch('/membros/me', auth, asyncHandler(controller.updateMe));

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
