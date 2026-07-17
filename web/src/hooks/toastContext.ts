import { createContext } from 'react';

export type ToastType = 'success' | 'error';

export interface Toast {
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  /** Mostra o toast; some sozinho em ~3.5s. Chamar de novo substitui o anterior. */
  showToast: (type: ToastType, message: string) => void;
}

/**
 * Canal de confirmação do sistema INTEIRO, não só de Membros
 * (docs/design/crud_membros/README.md). Contexto separado do provider para o hook
 * e o componente viverem em arquivos distintos sem quebrar o Fast Refresh.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
