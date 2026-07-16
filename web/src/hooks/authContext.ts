import { createContext } from 'react';
import type { AuthUser } from '@/services/types';

/**
 * Sessão do usuário. `user` sai do payload do JWT — é o que a UI usa para saber
 * quem está logado sem uma ida ao servidor. NÃO é garantia de permissão: quem
 * decide o que pode é a API, a cada request.
 *
 * O contexto mora num arquivo sem componente para o provider e o hook poderem
 * viver separados sem quebrar o Fast Refresh.
 */
export interface AuthContextValue {
  user: AuthUser | null;
  /** Guarda o token e abre a sessão. Devolve null se o token for inválido/expirado. */
  login: (token: string) => AuthUser | null;
  /** Descarta o token. É o logout inteiro — a auth é stateless, sem endpoint. */
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
