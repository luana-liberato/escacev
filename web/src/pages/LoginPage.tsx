import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { googleLoginUrl } from '@/services/http';
import { getHealth } from '@/services/health';

type ApiState = 'checking' | 'up' | 'down';

const API_STATE_STYLES: Record<ApiState, { dot: string; label: string }> = {
  checking: { dot: 'bg-amber-400', label: 'Verificando conexão com a API...' },
  up: { dot: 'bg-emerald-500', label: 'API conectada' },
  down: { dot: 'bg-red-500', label: 'Sem conexão com a API' },
};

/**
 * Único ponto de entrada: Google OAuth (Seção 5 da raiz). Não existe formulário
 * de e-mail/senha.
 *
 * O status da API fica aqui de propósito: se ela estiver fora, o login falharia
 * no meio do fluxo do Google, longe daqui — melhor avisar antes do clique.
 */
export default function LoginPage() {
  const { user } = useAuth();
  const [apiState, setApiState] = useState<ApiState>('checking');

  useEffect(() => {
    let active = true;
    getHealth()
      .then(() => active && setApiState('up'))
      .catch(() => active && setApiState('down'));
    return () => {
      active = false;
    };
  }, []);

  // Já logado não vê login.
  if (user) {
    return <Navigate to="/" replace />;
  }

  // NAVEGAÇÃO de verdade, não XHR: o Google precisa da janela para a tela de
  // consentimento, e a API termina o fluxo redirecionando de volta com ?token.
  const startGoogleLogin = () => {
    window.location.href = googleLoginUrl;
  };

  const style = API_STATE_STYLES[apiState];

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 p-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800">Escacev</h1>
        <p className="mt-1 text-sm text-slate-500">Sistema de Gestão de Escalas</p>

        <button
          type="button"
          onClick={startGoogleLogin}
          disabled={apiState === 'down'}
          className="mt-8 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Entrar com Google
        </button>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
          <span className="text-xs text-slate-400">{style.label}</span>
        </div>
      </div>
    </main>
  );
}
