import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageActionSlotContext } from '@/hooks/pageActionContext';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/http';
import { listMinistryCards, type MinistryCard } from '@/services/ministries';
import { MinistryModal } from './MinistryModal';

/**
 * Tela de Ministérios (docs/design/crud_ministerios) — cards escopados por papel.
 *
 * | | vê | cria | edita |
 * |---|---|---|---|
 * | ADMIN_GERAL | todos | sim | qualquer um |
 * | ADMIN_MINISTERIO | os que participa | não | só os que administra |
 * | MEMBRO | os que participa | não | não |
 *
 * O escopo do "vê" já vem decidido do servidor (`GET /ministerios/cards`). O que
 * o front decide é só o que mostrar de AÇÃO — botões são conveniência; a API é a
 * garantia (403 na escrita indevida).
 */
export default function MinistriesPage() {
  const { user } = useAuth();
  const actionSlot = useContext(PageActionSlotContext);
  const [cards, setCards] = useState<MinistryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; card: MinistryCard | null }>({
    open: false,
    card: null,
  });

  const isGeneralAdmin = user?.role === 'ADMIN_GERAL';

  const load = () => {
    setLoading(true);
    setError(null);
    listMinistryCards()
      .then(setCards)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (!user) return null;

  return (
    <div>
      {/* "+ Novo ministério" no header, via portal — só ADMIN_GERAL. */}
      {isGeneralAdmin &&
        actionSlot &&
        createPortal(
          <button
            type="button"
            onClick={() => setModal({ open: true, card: null })}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover"
          >
            <span className="text-base leading-none">+</span>Novo ministério
          </button>,
          actionSlot,
        )}

      {loading && <p className="text-[13.5px] text-muted">Carregando ministérios...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
          {/* Mensagem por ator, como no handoff. */}
          {isGeneralAdmin
            ? 'Nenhum ministério cadastrado ainda.'
            : user.role === 'ADMIN_MINISTERIO'
              ? 'Você ainda não administra nenhum ministério.'
              : 'Você ainda não participa de nenhum ministério.'}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {cards.map((card) => {
          // Editar: ADMIN_GERAL em qualquer um; admin de grupo só onde administra.
          const canEdit = isGeneralAdmin || card.isCurrentUserAdmin;
          return (
            <div
              key={card.id}
              className={`rounded-[14px] bg-white p-[18px] ${
                // Borda teal de 2px destaca os ministérios que o usuário administra.
                card.isCurrentUserAdmin ? 'border-2 border-brand' : 'border border-line'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="flex-1 text-[15px] font-bold text-ink">{card.name}</p>

                {card.isCurrentUserAdmin && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-bold text-brand">
                    Você administra
                  </span>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, card })}
                    className="text-[12.5px] font-semibold text-brand transition hover:text-brand-hover"
                  >
                    Editar
                  </button>
                )}
              </div>

              {card.description && (
                <p className="mb-3 text-[13px] leading-[1.5] text-muted">{card.description}</p>
              )}

              <p className="text-xs text-faint">Administradores: {adminLabel(card, user.memberId)}</p>
            </div>
          );
        })}
      </div>

      {modal.open && (
        <MinistryModal
          ministry={modal.card}
          onClose={() => setModal({ open: false, card: null })}
          onSaved={load}
        />
      )}
    </div>
  );
}

/** "Ana Souza (você), Bruno Lima" — marca o próprio usuário, como no handoff. */
function adminLabel(card: MinistryCard, currentMemberId: string): string {
  if (card.admins.length === 0) return 'Nenhum administrador definido';
  return card.admins
    .map((admin) => (admin.id === currentMemberId ? `${admin.name} (você)` : admin.name))
    .join(', ');
}
