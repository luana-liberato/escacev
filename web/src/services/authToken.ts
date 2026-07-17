import type { AuthUser } from './types';

/**
 * Guarda do JWT no browser. O token é a ÚNICA fonte de sessão — a autenticação é
 * stateless e não existe endpoint de logout: descartar o token aqui é o logout
 * (Seção 5 da raiz).
 *
 * localStorage (e não memória) para a sessão sobreviver a um refresh; e não
 * cookie porque a API espera `Authorization: Bearer` e não usa sessão de servidor.
 */
const STORAGE_KEY = 'escacev.token';

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Lê o payload do JWT sem validar a assinatura — quem valida é a API, a cada
 * request. Serve só para a UI saber o papel e o memberId sem uma ida ao servidor.
 * Nunca trate isto como garantia de permissão.
 *
 * Devolve null se o token estiver ausente, malformado ou expirado.
 */
export function decodeToken(token: string | null = getToken()): AuthUser | null {
  if (!token) return null;

  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    // base64url -> base64 antes de decodificar.
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as Partial<AuthUser> & { exp?: number };

    if (!claims.memberId || !claims.institutionId || !claims.role) return null;
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null;

    return {
      memberId: claims.memberId,
      institutionId: claims.institutionId,
      role: claims.role,
    };
  } catch {
    return null;
  }
}
