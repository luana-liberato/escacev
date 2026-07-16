import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';

/** Acesso à sessão. Lança se usado fora do <AuthProvider> — erro de montagem, não de runtime do usuário. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return context;
}
