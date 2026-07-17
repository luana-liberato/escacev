import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Tela de transição do OAuth: a API redireciona para cá (FRONTEND_URL) com o JWT
 * na query, e esta tela troca o `?token` por sessão e sai de cena.
 *
 * Não tem UI de erro própria — por decisão do handoff, toda falha volta ao login
 * exibindo o banner (`/login?error=...`). Assim existe um único lugar que fala de
 * erro de autenticação.
 *
 * A rota precisa casar com a FRONTEND_URL do .env da API; hoje
 * `http://localhost:5173/auth/callback`. Se a variável estiver vazia, a API
 * devolve o token em JSON e nunca chega aqui.
 */
export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // replace em todas as saídas: o callback não fica no histórico — voltar aqui
    // reprocessaria um token já consumido.

    // A API manda ?error= quando o login falha: ela conhece um endereço só (a
    // FRONTEND_URL, que aponta para cá), então é esta tela que repassa ao login —
    // o único lugar que fala de erro de autenticação. Chave desconhecida não vira
    // banner: o loginErrorMessage devolve null para o que não reconhece.
    const error = searchParams.get('error');
    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    if (!login(token)) {
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    navigate('/', { replace: true });
  }, [searchParams, login, navigate]);

  return (
    <main className="min-h-screen-safe flex flex-col items-center justify-center gap-[18px] bg-white px-5">
      <div
        aria-hidden="true"
        className="h-11 w-11 animate-spin-slow rounded-full border-4 border-line border-t-brand"
      />
      <p className="animate-pulse-soft text-sm font-medium text-muted">Conectando com o Google…</p>
    </main>
  );
}
