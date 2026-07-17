/**
 * Estados de erro do login, conforme o handoff. A chave viaja na query
 * (`/login?error=...`) porque quem detecta a falha é o callback — ou, no futuro,
 * a própria API ao redirecionar de volta.
 *
 * As mensagens espelham os AppError reais do fluxo de auth:
 * - auth_failed    <- 'Falha na autenticação com o Google' (401, AuthController)
 * - no_email       <- 'Conta Google sem e-mail disponível' (400, AuthController)
 * - not_authorized <- 'Usuário não autorizado — solicite um convite ao
 *                     administrador' (403, AuthenticateWithGoogleUseCase)
 * - api_error      <- validações da entidade Account (googleSub/e-mail ausentes)
 */
export type LoginErrorKey = 'auth_failed' | 'no_email' | 'not_authorized' | 'api_error';

const LOGIN_ERRORS: Record<LoginErrorKey, string> = {
  auth_failed: 'Falha na autenticação com o Google. Tente novamente.',
  no_email: 'Conta Google sem e-mail disponível. Use uma conta com e-mail público para continuar.',
  not_authorized: 'Usuário não autorizado — solicite um convite ao administrador do seu ministério.',
  api_error:
    'Não foi possível concluir o login (googleSub é obrigatório | E-mail é obrigatório). Tente novamente em instantes.',
};

/** Traduz a chave da query em mensagem. Chave desconhecida vira null — não inventamos erro. */
export function loginErrorMessage(key: string | null): string | null {
  if (!key) return null;
  return LOGIN_ERRORS[key as LoginErrorKey] ?? null;
}
