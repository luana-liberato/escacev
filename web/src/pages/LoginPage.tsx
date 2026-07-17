import { Navigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/useAuth';
import { googleLoginUrl } from '@/services/http';
import { loginErrorMessage } from './loginErrors';

/**
 * Ponto de entrada: o único método de autenticação é o Google OAuth (Seção 5 da
 * raiz) — não existe formulário de e-mail/senha.
 *
 * Layout conforme docs/design/handoff.md (tela 1).
 *
 * RESPONSIVO POR NATUREZA, não por uma "versão mobile": é um card centralizado
 * com largura máxima — no celular ele ocupa a tela menos a margem. Duas adaptações
 * que o handoff não especifica (ele só descreve mobile para o painel):
 *
 * 1. Padding do card menor abaixo de 640px. O design dá 360px de card com 40px de
 *    padding = 280px de conteúdo; num celular de 375px o card cai para 335px e o
 *    mesmo padding deixaria 255px — num iPhone SE (320px), só 200px. Abaixo de
 *    640px o padding encolhe para manter o texto respirando.
 * 2. `100svh` em vez de `100vh`: no navegador móvel a barra de endereço faz o
 *    `vh` valer mais que a área visível, e o card centralizaria num espaço que
 *    não existe, com scroll fantasma. `svh` é a altura estável (barra visível).
 */
export default function LoginPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const errorMessage = loginErrorMessage(searchParams.get('error'));

  // Já logado não vê login.
  if (user) {
    return <Navigate to="/" replace />;
  }

  // NAVEGAÇÃO de verdade, não XHR: o Google precisa da janela para a tela de
  // consentimento, e a API termina o fluxo redirecionando de volta com ?token.
  const startGoogleLogin = () => {
    window.location.href = googleLoginUrl;
  };

  return (
    <main className="min-h-screen-safe flex items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-[360px] rounded-[20px] border border-line bg-white px-6 py-10 text-center sm:px-10 sm:py-12">
        <Logo size={48} className="mx-auto mb-5 block" />

        <h1 className="font-display text-2xl font-extrabold leading-tight text-ink">
          Bem-vindo ao Escacev
        </h1>
        <p className="mt-2 text-sm leading-[1.5] text-muted">
          Gerencie as escalas do seu ministério, sem complicação.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-8 flex items-start gap-2.5 rounded-[10px] border border-alert-border bg-alert-bg px-3.5 py-3 text-left"
          >
            <span
              aria-hidden="true"
              className="mt-px flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-white"
            >
              !
            </span>
            <p className="text-[13px] leading-[1.5] text-alert-text">{errorMessage}</p>
          </div>
        )}

        <button
          type="button"
          onClick={startGoogleLogin}
          className={`flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white px-5 py-[13px] text-[15px] font-semibold text-ink transition hover:bg-highlight ${
            errorMessage ? 'mt-5' : 'mt-8'
          }`}
        >
          <span
            aria-hidden="true"
            className="inline-block h-[18px] w-[18px] rounded-full"
            style={{
              backgroundImage:
                'conic-gradient(#1C7C8C 0turn 0.25turn, #1C7C8C 0.25turn 0.5turn, #D4A017 0.5turn 0.75turn, #1A1A1A 0.75turn 1turn)',
            }}
          />
          Entrar com Google
        </button>

        <p className="mt-6 text-xs text-faint">Acesso restrito a convidados da sua igreja.</p>
      </div>
    </main>
  );
}
