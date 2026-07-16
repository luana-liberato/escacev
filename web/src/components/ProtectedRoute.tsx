import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Barra quem não tem sessão. É conveniência de UX, NÃO segurança: o que protege
 * o dado é o middleware `auth` da API, que exige o Bearer token em toda rota.
 * Sem token aqui, nenhuma request passaria de qualquer forma.
 */
export function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
