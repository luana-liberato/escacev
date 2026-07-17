import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarContent } from '@/components/SidebarContent';
import { navItemByPath } from '@/config/navigation';
import { PageActionSlotContext } from '@/hooks/pageActionContext';

/**
 * Layout base de TODAS as telas internas: sidebar de navegação + header com o
 * usuário logado (docs/design/layout_sidebar/README.md).
 *
 * As telas entram pelo <Outlet />. O título e o subtítulo do header vêm do mapa de
 * navegação — a tela não os repete.
 *
 * A partir de 861px (`nav:`) a sidebar é fixa; até 860px ela some e vira um drawer
 * aberto pelo hambúrguer.
 *
 * NÃO reproduz a moldura do protótipo (cartão de 1160px com sombra, sobre creme):
 * aquilo é vitrine de apresentação. No app real a casca É a tela — mesma decisão
 * tomada no login.
 */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Guardado em estado, não em ref: o filho precisa RE-RENDERIZAR quando o nó
  // existir. Com ref, o portal nunca apareceria no primeiro paint.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();
  const page = navItemByPath(pathname);

  // Fecha o drawer no Esc: quem abre uma gaveta espera poder fechá-la sem mirar
  // no overlay. O handoff não pede, mas é comportamento esperado de qualquer um.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-screen-safe flex bg-white">
      {/* Sidebar fixa — só no desktop. */}
      <aside className="hidden w-[232px] flex-shrink-0 flex-col border-r border-line bg-white px-4 py-6 nav:flex">
        <SidebarContent />
      </aside>

      {/* Drawer mobile + overlay. */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-overlay-soft nav:hidden"
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col bg-white px-4 py-6 shadow-drawer nav:hidden">
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-6 px-5 py-6 nav:px-7 nav:pb-10">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center gap-[3px] rounded-[10px] border border-line bg-white nav:hidden"
          >
            <span className="h-0.5 w-4 rounded-sm bg-ink" />
            <span className="h-0.5 w-4 rounded-sm bg-ink" />
            <span className="h-0.5 w-4 rounded-sm bg-ink" />
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-[22px] font-extrabold text-ink">{page?.title}</h1>
              <p className="mt-1 text-[13.5px] text-muted">{page?.subtitle}</p>
            </div>
            {/* Onde cada tela injeta a sua ação primária (o botão "+"), via
                portal. O layout não conhece tela nenhuma. */}
            <div ref={setActionSlot} />
          </div>
        </div>

        <PageActionSlotContext.Provider value={actionSlot}>
          <Outlet />
        </PageActionSlotContext.Provider>
      </div>
    </div>
  );
}
