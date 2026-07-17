import { useEffect, type ReactNode } from 'react';

/**
 * Casca de modal: overlay + cartão branco centralizado. Ganhou o direito de
 * existir porque o handoff usa a mesma forma em três lugares (Meu perfil,
 * Convidar e Editar membro).
 *
 * Fecha no Esc e no clique no overlay — o handoff só pede o Cancelar, mas quem
 * abre um modal espera as duas coisas.
 */
export function Modal({
  title,
  onClose,
  children,
  maxWidth = 380,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-5"
    >
      {/* O clique dentro do cartão não pode fechar: sem isto, digitar num campo
          fecharia o modal (o evento sobe até o overlay). */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full rounded-2xl bg-white p-7"
        style={{ maxWidth }}
      >
        <h3 className="mb-[18px] font-display text-lg font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}
