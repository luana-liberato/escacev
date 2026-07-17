import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type Toast, type ToastContextValue, type ToastType } from '@/hooks/toastContext';

const AUTO_DISMISS_MS = 3500;

const STYLES: Record<ToastType, { box: string; icon: string; text: string; glyph: string }> = {
  success: {
    box: 'bg-brand-soft border-toast-success-border',
    icon: 'bg-brand',
    text: 'text-brand-hover',
    glyph: '✓',
  },
  error: {
    box: 'bg-alert-bg border-alert-border',
    icon: 'bg-danger',
    text: 'text-alert-text',
    glyph: '!',
  },
};

/**
 * Toast global — fixo no topo central, para qualquer confirmação de sucesso ou
 * erro do sistema (docs/design/crud_membros/README.md), não só de Membros.
 *
 * Fica acima do BrowserRouter na árvore: qualquer tela chama `useToast()` sem
 * precisar montar nada.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((type: ToastType, message: string) => {
    // Um toast novo substitui o anterior: o timer velho precisa morrer junto,
    // senão ele apagaria o novo antes da hora.
    if (timer.current) clearTimeout(timer.current);
    setToast({ type, message });
    timer.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  // Timer pendente ao desmontar não deve tentar atualizar estado.
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);
  const style = toast ? STYLES[toast.type] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}

      {toast && style && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-5 z-[100] flex max-w-[90vw] -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4.5 py-3 shadow-toast ${style.box}`}
        >
          <span
            aria-hidden="true"
            className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${style.icon}`}
          >
            {style.glyph}
          </span>
          <p className={`text-[13.5px] font-semibold ${style.text}`}>{toast.message}</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso"
            className={`pl-1 text-[15px] leading-none opacity-60 transition hover:opacity-100 ${style.text}`}
          >
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
