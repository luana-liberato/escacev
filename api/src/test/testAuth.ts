import { JwtService, JwtPayload } from '../infra/services/jwt';

/**
 * Assina um JWT válido para uso EXCLUSIVO em testes automatizados — evita
 * depender do fluxo OAuth do browser para autenticar requisições nos testes de
 * rota. Reusa o JwtService de produção (mesmo segredo/expiração do .env); só
 * pula o login real. Não é importado por nenhum código de produção.
 */
export function signTestToken(payload: JwtPayload): string {
  return new JwtService().sign(payload);
}
