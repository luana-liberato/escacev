import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Fim do fluxo OAuth. A API redireciona para cá (FRONTEND_URL) com o JWT na
 * query — esta tela troca o `?token` por uma sessão e sai de cena.
 *
 * A rota precisa casar com a FRONTEND_URL do .env da API; hoje
 * `http://localhost:5173/auth/callback`. Se a variável estiver vazia, a API
 * devolve o token em JSON e nunca chega aqui.
 */
export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('O Google não devolveu um token. Tente entrar novamente.');
      return;
    }

    if (!login(token)) {
      setError('O token recebido é inválido ou já expirou. Tente entrar novamente.');
      return;
    }

    // replace: o callback não fica no histórico — voltar aqui reprocessaria um
    // token já consumido.
    navigate('/', { replace: true });
  }, [searchParams, login, navigate]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 p-8 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-slate-800">Não foi possível entrar</h1>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Voltar ao login
            </Link>
          </>
        ) : (
          <p className="text-sm text-slate-500">Concluindo o login...</p>
        )}
      </div>
    </main>
  );
}
