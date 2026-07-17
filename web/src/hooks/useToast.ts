import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from './toastContext';

/** Acesso ao toast global. Lança fora do <ToastProvider> — erro de montagem. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>');
  }
  return context;
}
