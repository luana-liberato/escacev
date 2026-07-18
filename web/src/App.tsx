import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DEFAULT_PATH, NAV_ITEMS } from '@/config/navigation';
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import LoginPage from '@/pages/LoginPage';
import MembersPage from '@/pages/members/MembersPage';
import MinistriesPage from '@/pages/ministries/MinistriesPage';
import PositionsPage from '@/pages/positions/PositionsPage';
import PlaceholderPage from '@/pages/PlaceholderPage';

/**
 * Rotas. `/login` e `/auth/callback` são públicas — o callback PRECISA ser, já
 * que é ele quem cria a sessão.
 *
 * Todo o resto exige sessão e vive dentro do AppLayout, que é a casca padrão de
 * todas as telas internas (sidebar + header). As telas internas saem do mesmo
 * mapa de navegação que alimenta o menu — assim rota, item de menu e cabeçalho
 * nunca saem de sincronia.
 *
 * O menu já é filtrado por perfil, mas as ROTAS ainda não: um MEMBRO que digitar
 * /ministerios abre a tela e leva 403 da API. Só vira problema quando as telas
 * reais existirem — hoje são placeholders.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/membros" element={<MembersPage />} />
          <Route path="/ministerios" element={<MinistriesPage />} />
          <Route path="/funcoes" element={<PositionsPage />} />
          {/* As demais saem do mapa de navegação e seguem como placeholder até a
              sua vez chegar. */}
          {NAV_ITEMS.filter(
            (item) =>
              item.path !== '/membros' &&
              item.path !== '/ministerios' &&
              item.path !== '/funcoes',
          ).map((item) => (
            <Route key={item.path} path={item.path} element={<PlaceholderPage />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
    </Routes>
  );
}
