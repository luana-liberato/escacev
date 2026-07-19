import { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PageActionSlotContext } from '@/hooks/pageActionContext';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/http';
import { listSchedules, getSchedule } from '@/services/schedules';
import { listEvents } from '@/services/events';
import { listMinistryCards, type MinistryCard } from '@/services/ministries';
import { listMemberUnavailabilities, overlapsUnavailability } from '@/services/unavailability';
import type { Event, Schedule, ScheduleStatus, Unavailability } from '@/services/types';
import { ScheduleStatusBadge } from '@/components/ScheduleStatusBadge';
import {
  formatDay,
  formatEventWhen,
  inPeriod,
  periodLabel,
  shiftAnchor,
  type PeriodMode,
} from './scheduleTime';
import { CreateScheduleModal } from './CreateScheduleModal';

const ALL = 'all';

/** Dados de alocação de uma escala, independentes de quem está logado. */
interface AllocInfo {
  count: number;
  memberIds: Set<string>;
  conflictMemberIds: Set<string>;
  /** Algum alocado está indisponível no horário do evento (RN05) — só computado p/ admin. */
  hasUnavailableMember: boolean;
}

/**
 * Tela de Escalas — lista (docs/design/crud_escalas). É tela de ADMIN: os dois
 * admins montam escalas (o de grupo só nos ministérios que administra). O MEMBRO
 * não chega aqui — a visão dele é a Agenda (GET /minhas-escalas).
 *
 * O GET /escalas devolve a escala "crua" (sem nomes nem alocações): resolvemos o
 * evento/ministério no cliente e enriquecemos com getSchedule por escala para
 * contagem, "está escalado" e o filtro "Minhas escalas".
 */
export default function SchedulesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const actionSlot = useContext(PageActionSlotContext);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [ministries, setMinistries] = useState<MinistryCard[]>([]);
  const [allocInfo, setAllocInfo] = useState<Map<string, AllocInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<PeriodMode>('mes');
  const [anchor, setAnchor] = useState(() => new Date());
  const [filterMinistry, setFilterMinistry] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState<typeof ALL | ScheduleStatus>(ALL);
  const [onlyMine, setOnlyMine] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listSchedules(), listEvents(), listMinistryCards()])
      .then(async ([scheds, evts, cards]) => {
        // Enriquecimento: a contagem e o "está escalado" precisam das alocações,
        // que só vêm no detalhe. Busca uma vez por escala (escala de igreja é
        // pequena); se um detalhe falhar, aquela escala fica sem enriquecimento.
        const details = await Promise.all(scheds.map((s) => getSchedule(s.id).catch(() => null)));
        const eventById = new Map(evts.map((e) => [e.id, e]));

        // Indisponibilidade (RN05): só o admin pode consultar a de outros membros.
        // Busca uma vez por membro alocado e checa a sobreposição com cada evento.
        const isAdminUser = user?.role === 'ADMIN_GERAL' || user?.role === 'ADMIN_MINISTERIO';
        const unavByMember = new Map<string, Unavailability[]>();
        if (isAdminUser) {
          const memberIds = new Set<string>();
          details.forEach((d) => d?.assignments.forEach((a) => memberIds.add(a.member.id)));
          const fetched = await Promise.all(
            [...memberIds].map((mid) =>
              listMemberUnavailabilities(mid)
                .then((list) => [mid, list] as const)
                .catch(() => [mid, [] as Unavailability[]] as const),
            ),
          );
          for (const [mid, list] of fetched) unavByMember.set(mid, list);
        }

        const info = new Map<string, AllocInfo>();
        scheds.forEach((s, i) => {
          const assignments = details[i]?.assignments ?? [];
          const ev = eventById.get(s.eventId);
          const hasUnavailableMember =
            !!ev &&
            assignments.some((a) =>
              overlapsUnavailability(unavByMember.get(a.member.id) ?? [], ev.startsAt, ev.endsAt),
            );
          info.set(s.id, {
            count: assignments.length,
            memberIds: new Set(assignments.map((a) => a.member.id)),
            conflictMemberIds: new Set(assignments.filter((a) => a.conflict).map((a) => a.member.id)),
            hasUnavailableMember,
          });
        });
        setSchedules(scheds);
        setEvents(evts);
        setMinistries(cards);
        setAllocInfo(info);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user?.role]);

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const isGeneralAdmin = user?.role === 'ADMIN_GERAL';
  const isMember = user?.role === 'MEMBRO';
  /**
   * Ministérios cujas escalas o ator VÊ: geral todas; grupo as que administra;
   * membro as que participa (os cards que a API já devolve para ele).
   */
  const visibleMinistries = useMemo(
    () =>
      isGeneralAdmin || isMember ? ministries : ministries.filter((m) => m.isCurrentUserAdmin),
    [isGeneralAdmin, isMember, ministries],
  );
  /** Ministérios em que pode CRIAR escala: geral todos; grupo os que administra; membro nenhum. */
  const writableMinistries = useMemo(
    () =>
      isMember ? [] : isGeneralAdmin ? ministries : ministries.filter((m) => m.isCurrentUserAdmin),
    [isMember, isGeneralAdmin, ministries],
  );
  const scopedIds = useMemo(() => new Set(visibleMinistries.map((m) => m.id)), [visibleMinistries]);

  const rows = useMemo(() => {
    const now = Date.now();
    return schedules
      .filter((s) => scopedIds.has(s.ministryId))
      .map((s) => {
        const event = eventById.get(s.eventId);
        const ministry = ministries.find((m) => m.id === s.ministryId);
        const info = allocInfo.get(s.id);
        const memberId = user?.memberId;
        return {
          schedule: s,
          event,
          ministryName: ministry?.name ?? '—',
          count: info?.count ?? 0,
          isMemberIn: !!memberId && (info?.memberIds.has(memberId) ?? false),
          memberHasConflict: !!memberId && (info?.conflictMemberIds.has(memberId) ?? false),
          // Escala tem ALGUM conflito (qualquer alocação) — indicador para admins.
          hasScheduleConflict: (info?.conflictMemberIds.size ?? 0) > 0,
          hasUnavailableMember: info?.hasUnavailableMember ?? false,
        };
      })
      .filter((r): r is typeof r & { event: Event } => r.event !== undefined)
      .filter((r) => !onlyMine || r.isMemberIn)
      .filter((r) => inPeriod(r.event.startsAt, anchor, mode))
      .filter((r) => filterMinistry === ALL || r.schedule.ministryId === filterMinistry)
      .filter((r) => filterStatus === ALL || r.schedule.status === filterStatus)
      .sort((a, b) => {
        const da = new Date(a.event.startsAt).getTime();
        const db = new Date(b.event.startsAt).getTime();
        const aPast = da < now;
        const bPast = db < now;
        if (aPast !== bPast) return aPast ? 1 : -1; // passadas afundam
        return da - db;
      });
  }, [schedules, scopedIds, ministries, eventById, allocInfo, user, onlyMine, anchor, mode, filterMinistry, filterStatus]);

  if (!user) return null;

  const canCreate = writableMinistries.length > 0;
  const isAdmin = user.role === 'ADMIN_GERAL' || user.role === 'ADMIN_MINISTERIO';
  const now = Date.now();

  return (
    <div>
      {canCreate &&
        actionSlot &&
        createPortal(
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover"
          >
            <span className="text-base leading-none">+</span>Nova escala
          </button>,
          actionSlot,
        )}

      {/* Período: modo (dia/semana/mês) + navegação + "Minhas escalas". */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as PeriodMode)}
          className="rounded-[10px] border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-ink"
        >
          <option value="dia">Dia</option>
          <option value="semana">Semana</option>
          <option value="mes">Mês</option>
        </select>
        <button
          type="button"
          aria-label="Período anterior"
          onClick={() => setAnchor(shiftAnchor(anchor, mode, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition hover:bg-highlight"
        >
          ‹
        </button>
        <span className="min-w-0 flex-1 text-center text-[13px] font-semibold text-ink sm:min-w-[160px] sm:flex-none">
          {periodLabel(anchor, mode)}
        </span>
        <button
          type="button"
          aria-label="Próximo período"
          onClick={() => setAnchor(shiftAnchor(anchor, mode, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition hover:bg-highlight"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => setAnchor(new Date())}
          className="rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-semibold text-brand transition hover:text-brand-hover"
        >
          Hoje
        </button>
        </div>

        <button
          type="button"
          onClick={() => setOnlyMine((v) => !v)}
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition sm:ml-auto ${
            onlyMine ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:bg-highlight'
          }`}
        >
          Minhas escalas
        </button>
      </div>

      {/* Filtros (ministério e status), rotulados por grupo — escondidos para o MEMBRO. */}
      {!isMember && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="w-[68px] text-[11.5px] font-semibold text-faint">Ministério</span>
            {[{ id: ALL, name: 'Todos' }, ...visibleMinistries.map((m) => ({ id: m.id, name: m.name }))].map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterMinistry(item.id)}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                    filterMinistry === item.id
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-ink hover:bg-highlight'
                  }`}
                >
                  {item.name}
                </button>
              ),
            )}
          </div>
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <span className="w-[68px] text-[11.5px] font-semibold text-faint">Status</span>
            {[
              { id: ALL, name: 'Todas' },
              { id: 'RASCUNHO', name: 'Rascunho' },
              { id: 'PUBLICADA', name: 'Publicada' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilterStatus(item.id as typeof ALL | ScheduleStatus)}
                className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                  filterStatus === item.id
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-white text-ink hover:bg-highlight'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      )}

      {loading && <p className="text-[13.5px] text-muted">Carregando escalas...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
          Nenhuma escala criada ainda.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const isPast = new Date(r.event.startsAt).getTime() < now;
          const displayName = r.schedule.name || r.event.name;
          // Evento multi-dia: mostra o dia a que a escala se refere (distingue as escalas).
          const eventMultiDay =
            new Date(r.event.startsAt).toDateString() !== new Date(r.event.endsAt).toDateString();
          // Prioridade visual: indisponível (vermelho, só admin) > conflito (âmbar)
          // > minha (teal). Indisponibilidade é mais grave que conflito de agenda.
          const showUnavailable = isAdmin && r.hasUnavailableMember;
          const showConflict =
            !showUnavailable && (r.memberHasConflict || (isAdmin && r.hasScheduleConflict));
          const showMine = r.isMemberIn && !showUnavailable && !showConflict;
          const border = showUnavailable
            ? '2px solid #C0392B'
            : showConflict
              ? '2px solid #8A6D1F'
              : showMine
                ? '2px solid #1C7C8C'
                : '1px solid #EAE2D4';
          const bg = showUnavailable
            ? '#FDEDEB'
            : showConflict
              ? '#FEFAF0'
              : showMine
                ? '#F2F9F8'
                : '#FFFFFF';
          return (
            <button
              key={r.schedule.id}
              type="button"
              onClick={() => navigate(`/escalas/${r.schedule.id}`)}
              style={{ border, background: bg, opacity: isPast ? 0.55 : 1 }}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-3.5 text-left transition hover:brightness-[0.99]"
            >
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <div className="flex items-center gap-2">
                  {r.isMemberIn && (
                    <span
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: r.memberHasConflict ? '#8A6D1F' : '#1C7C8C' }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                  <p className="truncate text-sm font-bold text-ink">{displayName}</p>
                </div>
                {showUnavailable && (
                  <p className="mt-0.5">
                    <span className="inline-block whitespace-nowrap rounded-full bg-danger px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      Membro indisponível
                    </span>
                  </p>
                )}
                {r.isMemberIn && (
                  <p
                    className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: r.memberHasConflict ? '#8A6D1F' : '#1C7C8C' }}
                  >
                    {r.memberHasConflict && (
                      <span
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: '#8A6D1F' }}
                        aria-hidden="true"
                      >
                        !
                      </span>
                    )}
                    {r.memberHasConflict
                      ? 'Você está escalado com conflito em outra escala'
                      : 'Você está escalado'}
                  </p>
                )}
                {isAdmin && r.hasScheduleConflict && !r.memberHasConflict && (
                  <p
                    className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: '#8A6D1F' }}
                  >
                    <span
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: '#8A6D1F' }}
                      aria-hidden="true"
                    >
                      !
                    </span>
                    Esta escala tem conflitos
                  </p>
                )}
                <p className="mt-0.5 text-[12px] text-faint">
                  {r.event.name} · {formatEventWhen(r.event.startsAt, r.event.endsAt)}
                  {eventMultiDay && r.schedule.date && <> · Dia {formatDay(r.schedule.date)}</>}
                </p>
              </div>

              <span className="whitespace-nowrap rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                {r.ministryName}
              </span>
              <ScheduleStatusBadge status={r.schedule.status} />
              <span className="whitespace-nowrap text-[12px] text-muted">
                {r.count} {r.count === 1 ? 'escalado' : 'escalados'}
              </span>
            </button>
          );
        })}
      </div>

      {createOpen && (
        <CreateScheduleModal
          ministries={writableMinistries.map((m) => ({ id: m.id, name: m.name }))}
          events={events}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => navigate(`/escalas/${id}`)}
        />
      )}
    </div>
  );
}
