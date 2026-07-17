import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { navItemByPath, navItemsFor } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * Guarda de navegação: exige sessão e, depois, que o perfil alcance a rota.
 *
 * É conveniência de UX, NÃO segurança. Quem protege o dado é o middleware `auth`
 * + `rbac` da API, que roda a cada request. Aqui a gente só evita que a pessoa
 * abra uma tela e leve um 403 sem explicação — o menu já esconde o item, mas a
 * URL continua digitável, colável e favoritável.
 *
 * O filtro é grosso, por `role` global. A permissão ESCOPADA por ministério
 * (`isAdmin`) continua sendo do back: um ADMIN_MINISTERIO abre /ministerios
 * normalmente e leva 403 ao editar um que não administra. Reimplementar isso
 * aqui seria duplicar regra de negócio (Seção 4 do CLAUDE.md do web).
 */
export function ProtectedRoute() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const page = navItemByPath(pathname);
  const home = navItemsFor(user.role)[0]?.path;

  // Rota conhecida que este perfil não alcança → primeira tela dele.
  //
  // Redireciona para a primeira PERMITIDA, e não para uma constante, porque uma
  // constante que o perfil também não alcançasse viraria loop infinito de
  // redirect. O `home !== pathname` é o cinto de segurança do mesmo problema.
  if (page && !page.roles.includes(user.role) && home && home !== pathname) {
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
