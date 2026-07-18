import { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageActionSlotContext } from '@/hooks/pageActionContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { listCompatibilityPairs, type CompatibilityPair } from '@/services/compatibility';
import { listInstitutionPositions, removePosition, type InstitutionPosition } from '@/services/positions';
import { listMinistryCards, type MinistryCard } from '@/services/ministries';
import { PositionModal } from './PositionModal';

const ALL = 'all';

/**
 * Tela de Funções (docs/design/crud_funções) — CRUD de funções com a
 * compatibilidade embutida no modal.
 *
 * | | ADMIN_GERAL | ADMIN_MINISTERIO |
 * |---|---|---|
 * | Vê na lista | todas | só as dos ministérios que administra |
 * | Cria/edita/exclui | qualquer | só nos que administra |
 * | Compatibilidade | contra todas as funções da instituição (o par cruza ministérios) |
 *
 * O MEMBRO não chega aqui (item fora do menu dele + ProtectedRoute; garantia final
 * é o rbac da API).
 */
export default function PositionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const actionSlot = useContext(PageActionSlotContext);

  const [positions, setPositions] = useState<InstitutionPosition[]>([]);
  const [pairs, setPairs] = useState<CompatibilityPair[]>([]);
  const [ministryCards, setMinistryCards] = useState<MinistryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(ALL);
  const [modal, setModal] = useState<{ open: boolean; position: InstitutionPosition | null }>({
    open: false,
    position: null,
  });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const isGeneralAdmin = user?.role === 'ADMIN_GERAL';

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listInstitutionPositions(), listCompatibilityPairs(), listMinistryCards()])
      .then(([pos, prs, cards]) => {
        setPositions(pos);
        setPairs(prs);
        setMinistryCards(cards);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /** Ministérios em que o ator pode CRIAR/EDITAR função: todos, ou os que administra. */
  const writableMinistries = useMemo(
    () =>
      isGeneralAdmin
        ? ministryCards.map((c) => ({ id: c.id, name: c.name }))
        : ministryCards.filter((c) => c.isCurrentUserAdmin).map((c) => ({ id: c.id, name: c.name })),
    [isGeneralAdmin, ministryCards],
  );
  const writableIds = useMemo(() => new Set(writableMinistries.map((m) => m.id)), [writableMinistries]);

  /**
   * Funções da LISTA: o admin geral vê todas; o admin de grupo só as dos
   * ministérios que administra. (A compatibilidade, no modal, sempre vê todas.)
   */
  const listablePositions = useMemo(
    () => (isGeneralAdmin ? positions : positions.filter((p) => writableIds.has(p.ministryId))),
    [isGeneralAdmin, positions, writableIds],
  );

  /** Chips de filtro: os ministérios presentes na lista. */
  const filterMinistries = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of listablePositions) map.set(p.ministryId, p.ministryName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [listablePositions]);

  const visible = useMemo(
    () => listablePositions.filter((p) => filter === ALL || p.ministryId === filter),
    [listablePositions, filter],
  );

  const del = async (id: string) => {
    try {
      await removePosition(id);
      showToast('success', 'Função excluída.');
      setConfirmingDelete(null);
      load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível excluir.');
    }
  };

  if (!user) return null;

  const canCreate = writableMinistries.length > 0;

  return (
    <div>
      {canCreate &&
        actionSlot &&
        createPortal(
          <button
            type="button"
            onClick={() => setModal({ open: true, position: null })}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover"
          >
            <span className="text-base leading-none">+</span>Nova função
          </button>,
          actionSlot,
        )}

      {filterMinistries.length > 1 && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          {[{ id: ALL, name: 'Todos' }, ...filterMinistries].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                filter === item.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink hover:bg-highlight'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-[13.5px] text-muted">Carregando funções...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
          {isGeneralAdmin
            ? 'Nenhuma função cadastrada ainda.'
            : 'Você não administra ministérios com funções cadastradas.'}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visible.map((p) => {
          const canManage = isGeneralAdmin || writableIds.has(p.ministryId);
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-white px-4 py-3.5"
            >
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="truncate text-sm font-bold text-ink">{p.name}</p>
              </div>

              <span className="rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                {p.ministryName}
              </span>

              {canManage && (
                <div className="flex w-full items-center justify-end gap-3.5 whitespace-nowrap sm:ml-auto sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, position: p })}
                    className="-mx-1 -my-2 px-1 py-2 text-[13px] font-semibold text-brand transition hover:text-brand-hover"
                  >
                    Editar
                  </button>

                  {/* Confirmação inline em 2 etapas — mesmo padrão de Ministérios. */}
                  {confirmingDelete === p.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => del(p.id)}
                        className="-mx-1 -my-2 px-1 py-2 text-[13px] font-semibold text-danger transition hover:opacity-80"
                      >
                        Confirmar exclusão
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(null)}
                        className="-mx-1 -my-2 px-1 py-2 text-[13px] font-semibold text-faint transition hover:text-muted"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(p.id)}
                      className="-mx-1 -my-2 px-1 py-2 text-[13px] font-semibold text-faint transition hover:text-muted"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal.open && (
        <PositionModal
          position={modal.position}
          allPositions={positions}
          pairs={pairs}
          ministries={writableMinistries}
          onClose={() => setModal({ open: false, position: null })}
          onSaved={load}
        />
      )}
    </div>
  );
}
