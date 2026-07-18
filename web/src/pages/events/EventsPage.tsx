import { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageActionSlotContext } from '@/hooks/pageActionContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { listEvents, removeEvent } from '@/services/events';
import type { Event, EventType } from '@/services/types';
import { EVENT_TYPES, eventTypeMeta } from './eventTypes';
import { EventModal } from './EventModal';

const ALL = 'all';

/** Referência de mês exibido (ano + índice 0-11), independente de fuso da UI local. */
interface MonthRef {
  year: number;
  month: number;
}

/** Situação temporal do evento em relação ao "agora". */
type EventPhase = 'past' | 'ongoing' | 'upcoming';

/**
 * Tela de Eventos (docs/design/crud_eventos) — calendário da instituição.
 *
 * Evento é escopo de INSTITUIÇÃO: os dois admins (geral e de grupo) têm as mesmas
 * ações aqui (criar, editar, excluir), sem distinção. O MEMBRO não chega (item
 * fora do menu dele + a rota da API é admin-only). Excluir evento com escala
 * vinculada falha com 409 — a mensagem da API vira toast de erro.
 *
 * Filtros: período por MÊS (padrão = mês atual, navegável) + tipo. Cada evento é
 * marcado pela sua fase temporal — "Finalizado" (já terminou, recuado), "Em
 * andamento" (acontecendo agora) ou agendado (futuro, visual normal).
 */
export default function EventsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const actionSlot = useContext(PageActionSlotContext);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<EventType | typeof ALL>(ALL);
  const [monthRef, setMonthRef] = useState<MonthRef>(currentMonth);
  const [modal, setModal] = useState<{ open: boolean; event: Event | null }>({
    open: false,
    event: null,
  });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    listEvents()
      .then(setEvents)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /**
   * Eventos do mês em foco, filtrados por tipo. Ordem: os NÃO finalizados primeiro
   * (em andamento + agendados), os finalizados afundam para o fim — dentro de cada
   * grupo, cronológico (asc), então o próximo evento fica no topo.
   */
  const visible = useMemo(() => {
    const now = Date.now();
    const isPast = (e: Event) => (eventPhase(e, now) === 'past' ? 1 : 0);
    return [...events]
      .filter((e) => inMonth(e.startsAt, monthRef))
      .filter((e) => typeFilter === ALL || e.type === typeFilter)
      .sort((a, b) => {
        const byPhase = isPast(a) - isPast(b);
        if (byPhase !== 0) return byPhase;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  }, [events, monthRef, typeFilter]);

  const del = async (id: string) => {
    try {
      await removeEvent(id);
      showToast('success', 'Evento excluído com sucesso.');
      setConfirmingDelete(null);
      load();
    } catch (err) {
      // 409 (escalas vinculadas) e afins: a mensagem vem pronta da API.
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível excluir.');
      setConfirmingDelete(null);
    }
  };

  if (!user) return null;

  const canManage = user.role === 'ADMIN_GERAL' || user.role === 'ADMIN_MINISTERIO';
  const now = Date.now();
  const onCurrentMonth = isCurrentMonth(monthRef);

  return (
    <div>
      {canManage &&
        actionSlot &&
        createPortal(
          <button
            type="button"
            onClick={() => setModal({ open: true, event: null })}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover"
          >
            <span className="text-base leading-none">+</span>Novo evento
          </button>,
          actionSlot,
        )}

      {/* Período: navegador de mês (padrão = mês atual). */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setMonthRef(shiftMonth(monthRef, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition hover:bg-highlight"
        >
          ‹
        </button>
        <span className="min-w-[150px] text-center text-[13.5px] font-semibold text-ink">
          {monthLabel(monthRef)}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => setMonthRef(shiftMonth(monthRef, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition hover:bg-highlight"
        >
          ›
        </button>
        {!onCurrentMonth && (
          <button
            type="button"
            onClick={() => setMonthRef(currentMonth())}
            className="ml-1 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold text-brand transition hover:text-brand-hover"
          >
            Hoje
          </button>
        )}
      </div>

      {/* Tipo. */}
      <div className="mb-3.5 flex flex-wrap gap-2">
        {[{ id: ALL, name: 'Todos' }, ...EVENT_TYPES.map((m) => ({ id: m.type, name: m.label }))].map(
          (item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTypeFilter(item.id as EventType | typeof ALL)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                typeFilter === item.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink hover:bg-highlight'
              }`}
            >
              {item.name}
            </button>
          ),
        )}
      </div>

      {loading && <p className="text-[13.5px] text-muted">Carregando eventos...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
          Nenhum evento em {monthLabel(monthRef).toLowerCase()}.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visible.map((event) => {
          const meta = eventTypeMeta(event.type);
          const phase = eventPhase(event, now);
          const past = phase === 'past';
          return (
            <div
              key={event.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line px-4 py-3.5 ${
                past ? 'bg-cream' : 'bg-white'
              }`}
            >
              <p
                className={`w-full min-w-0 text-sm font-bold sm:w-auto sm:flex-1 ${
                  past ? 'text-muted' : 'text-ink'
                }`}
              >
                {event.name}
              </p>

              <span
                className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                style={{ backgroundColor: meta.bg, color: meta.fg }}
              >
                {meta.label}
              </span>

              <PhaseBadge phase={phase} />

              <span
                className={`whitespace-nowrap text-[12.5px] ${past ? 'text-faint' : 'text-muted'}`}
              >
                {formatWhen(event.startsAt, event.endsAt)}
              </span>

              {canManage && (
                <div className="flex w-full items-center justify-end gap-3.5 whitespace-nowrap sm:ml-auto sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, event })}
                    className="-mx-1 -my-2 px-1 py-2 text-[13px] font-semibold text-brand transition hover:text-brand-hover"
                  >
                    Editar
                  </button>

                  {confirmingDelete === event.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => del(event.id)}
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
                      onClick={() => setConfirmingDelete(event.id)}
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
        <EventModal
          event={modal.event}
          onClose={() => setModal({ open: false, event: null })}
          onSaved={load}
        />
      )}
    </div>
  );
}

/** Selo da fase: "Finalizado" (neutro) ou "Em andamento" (teal). Futuro não tem selo. */
function PhaseBadge({ phase }: { phase: EventPhase }) {
  if (phase === 'past') {
    return (
      <span className="whitespace-nowrap rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-semibold text-muted">
        Finalizado
      </span>
    );
  }
  if (phase === 'ongoing') {
    return (
      <span className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-hover">
        Em andamento
      </span>
    );
  }
  return null;
}

/** Fase do evento em relação a `now` (ms): terminou, acontecendo agora, ou futuro. */
function eventPhase(event: Event, now: number): EventPhase {
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  if (end < now) return 'past';
  if (start <= now) return 'ongoing';
  return 'upcoming';
}

/** Mês corrente no fuso local. */
function currentMonth(): MonthRef {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function isCurrentMonth(ref: MonthRef): boolean {
  const c = currentMonth();
  return ref.year === c.year && ref.month === c.month;
}

/** Avança/retrocede `delta` meses, normalizando a virada de ano. */
function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(ref.year, ref.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** true se o início do evento cai no mês em foco (fuso local). */
function inMonth(startsAt: string, ref: MonthRef): boolean {
  const d = new Date(startsAt);
  return d.getFullYear() === ref.year && d.getMonth() === ref.month;
}

/** "Julho de 2026" (mês capitalizado). */
function monthLabel(ref: MonthRef): string {
  const label = new Date(ref.year, ref.month, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Rótulo de data/hora do evento: "Dom, 20/07 · 19h00–21h00". Data e horas são
 * lidas no fuso LOCAL do usuário (a API guarda em UTC). Se o término cair em outro
 * dia, a data dele também aparece.
 */
function formatWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const dateLabel = (d: Date) => {
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  const time = (d: Date) =>
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dateLabel(start)} · ${time(start)}–${time(end)}`
    : `${dateLabel(start)} ${time(start)} → ${dateLabel(end)} ${time(end)}`;
}
