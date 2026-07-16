import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/services/types';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_GERAL: 'Administrador Geral',
  ADMIN_MINISTERIO: 'Administrador de Ministério',
  MEMBRO: 'Membro',
};

/**
 * Painel provisório — existe para provar a jornada de ponta a ponta (login →
 * callback → sessão → rota protegida). Mostra apenas o que o JWT carrega
 * (memberId, role): não há endpoint "meus dados" e `GET /membros/:id` exige
 * perfil de admin, então o nome do usuário ainda não é obtenível para um MEMBRO.
 *
 * Vira o painel de verdade quando a listagem de ministérios entrar.
 */
export default function HomePage() {
  const { user, logout } = useAuth();
  if (!user) return null; // ProtectedRoute já garante; guarda só para estreitar o tipo.

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 p-8">
        <h1 className="text-xl font-semibold text-slate-800">Você está autenticado</h1>
        <p className="mt-1 text-sm text-slate-500">Sessão aberta com a conta Google.</p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Perfil</dt>
            <dd className="font-medium text-slate-700">{ROLE_LABELS[user.role]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Membro</dt>
            <dd className="font-mono text-xs text-slate-600 break-all">{user.memberId}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={logout}
          className="mt-8 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Sair
        </button>
      </div>
    </main>
  );
}
