import { RequestHandler } from 'express';
import { PerfilUsuario } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { PrismaMemberRepository } from '../../database/repositories/PrismaMemberRepository';
import { JwtService } from '../../services/jwt';

/**
 * Dados do usuário autenticado, injetados em req.user pelo middleware auth.
 * O institutionId vem SEMPRE daqui — nunca do body da request (Seção 4.5).
 */
export interface AuthenticatedUser {
  memberId: string;
  institutionId: string;
  role: PerfilUsuario;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Estende o User do passport/express com o nosso payload autenticado,
    // mantendo req.user com um único tipo coerente em toda a aplicação.
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AuthenticatedUser {}
  }
}

const jwtService = new JwtService();
const memberRepo = new PrismaMemberRepository();

/**
 * Valida o Bearer token e injeta `req.user`.
 *
 * O JWT prova QUEM é a pessoa (`memberId`); o PERFIL e o STATUS vêm do banco, a
 * cada request.
 *
 * POR QUÊ, e não direto do token: o perfil MUDA. Um admin promove alguém e o
 * token daquela pessoa continua dizendo `MEMBRO` por até `JWT_EXPIRES_IN` (7d) —
 * o menu não aparece e o `rbac` a barra, então promover não promovia. Com a
 * derivação de perfil (marcar "admin" num ministério vira ADMIN_MINISTERIO), o
 * papel ficou ainda mais dinâmico.
 *
 * E o caso grave: DESATIVAR não desativava. O `ativo = false` ia para o banco e a
 * pessoa seguia usando o sistema com o token antigo, por dias. Isso é falha de
 * segurança, não de UX.
 *
 * O custo é uma consulta indexada por request — irrelevante na escala de uma
 * igreja, e o preço justo por promoção e desativação valerem na hora.
 *
 * O membro desativado recebe 401 (e não 403) de propósito: o front derruba a
 * sessão no 401, então ele volta ao login em vez de ficar "logado" colecionando
 * erros em cada tela.
 *
 * LOGOUT: o cliente descarta o token. Não há lista de revogação — desativar o
 * membro é o que corta o acesso, e agora corta de verdade.
 */
export const auth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token de autenticação ausente', 401);
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError('Token de autenticação ausente', 401);
  }

  const payload = jwtService.verify(token);

  const member = await memberRepo.findById(payload.memberId);
  if (!member) {
    // Token válido para um membro que não existe mais: trata como não autenticado.
    throw new AppError('Token inválido ou expirado', 401);
  }
  if (!member.active) {
    throw new AppError('Seu acesso foi desativado. Fale com o administrador', 401);
  }

  req.user = {
    memberId: member.id,
    institutionId: member.institutionId,
    role: member.role,
  };

  next();
});
