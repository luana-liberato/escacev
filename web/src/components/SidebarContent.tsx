import { NavLink } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ROLE_LABELS, navItemsFor } from '@/config/navigation';
import { initialsOf, useCurrentMember } from '@/hooks/useCurrentMember';
import { useAuth } from '@/hooks/useAuth';

/**
 * Miolo da sidebar: marca, navegação e o bloco do usuário. Um componente só
 * porque o desktop e o drawer mobile mostram exatamente o mesmo conteúdo — no
 * handoff o markup é duplicado; aqui não precisa ser.
 *
 * `onNavigate` fecha o drawer ao clicar num item (no desktop não é passado).
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { member, loading } = useCurrentMember();

  if (!user) return null; // ProtectedRoute já garante; guarda só para estreitar o tipo.

  const items = navItemsFor(user.role);

  return (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <Logo size={26} className="flex-shrink-0" />
        <span className="font-display text-[17px] font-extrabold text-ink">Escacev</span>
      </div>

      <nav className="flex flex-col">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `mb-0.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold transition ${
                isActive ? 'bg-highlight text-ink' : 'text-muted hover:bg-highlight'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 border-t border-line px-2 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand">
          {member ? initialsOf(member.name) : ''}
        </div>
        <div className="min-w-0">
          {/* O papel vem do JWT e aparece na hora; o nome depende do /membros/me. */}
          {loading ? (
            <div className="h-3.5 w-24 animate-pulse rounded bg-highlight" />
          ) : (
            <p className="truncate text-[13px] font-semibold text-ink">
              {member?.name ?? 'Usuário'}
            </p>
          )}
          <p className="text-[11.5px] text-muted">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={logout}
        className="mt-1 p-2 text-left text-[13px] text-faint transition hover:text-muted"
      >
        Sair
      </button>
    </>
  );
}
