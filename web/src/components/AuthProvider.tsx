import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '@/hooks/authContext';
import { clearToken, decodeToken, setToken } from '@/services/authToken';
import { setUnauthorizedHandler } from '@/services/http';
import type { AuthUser } from '@/services/types';

/**
 * Provê a sessão à árvore. O estado inicial é lido do localStorage de forma
 * síncrona (o token já está lá, ou não está) — por isso não existe estado de
 * "carregando sessão": não há ida ao servidor para restaurar login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => decodeToken());

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const login = useCallback((token: string): AuthUser | null => {
    const decoded = decodeToken(token);
    // Token ilegível/expirado não abre sessão nem suja o localStorage — senão a
    // rota protegida devolveria ao login num vai-e-volta sem explicação.
    if (!decoded) return null;

    setToken(token);
    setUser(decoded);
    return decoded;
  }, []);

  // A API é a fonte da verdade sobre o token: se ela responder 401 (expirado no
  // servidor, secret trocado), a sessão local cai junto.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
