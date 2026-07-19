import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { listEvents } from '@/services/events';
import { getMySchedule } from '@/services/mySchedule';
import { getSchedule, listSchedules } from '@/services/schedules';
import { listMinistryCards } from '@/services/ministries';
import {
  listMemberUnavailabilities,
  listMyUnavailabilities,
  overlapsUnavailability,
  removeUnavailability,
} from '@/services/unavailability';
import type { Event, MemberScheduleEntry, Schedule, Unavailability } from '@/services/types';
import { ScheduleStatusBadge } from '@/components/ScheduleStatusBadge';
import { UnavailabilityModal } from './UnavailabilityModal';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Chave de dia local "YYYY-MM-DD" de um ISO. */
function dateKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "19h00" (hora local de um ISO). */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

/** Escala no escopo do admin, já com os sinais de conflito e indisponibilidade. */
interface AdminSchedule {
  schedule: Schedule;
  ministryName: string;
  hasConflict: boolean;
  hasUnavailable: boolean;
}

/**
 * Carrega as escalas do escopo do admin, enriquecidas com os sinais de conflito
 * (RN01) e de membro indisponível (RN05). Escopo pelos cards de ministério que a
 * API devolve ao ator (ADMIN_GERAL: todos; ADMIN_MINISTERIO: os que participa).
 */
async function loadAdminSchedules(events: Event[]): Promise<AdminSchedule[]> {
  const [scheds, cards] = await Promise.all([listSchedules(), listMinistryCards()]);
  const scopedIds = new Set(cards.map((c) => c.id));
  const scoped = scheds.filter((s) => scopedIds.has(s.ministryId));
  const details = await Promise.all(scoped.map((s) => getSchedule(s.id).catch(() => null)));

  const memberIds = new Set<string>();
  details.forEach((d) => d?.assignments.forEach((a) => memberIds.add(a.member.id)));
  const unavPairs = await Promise.all(
    [...memberIds].map((mid) =>
      listMemberUnavailabilities(mid)
        .then((list) => [mid, list] as [string, Unavailability[]])
        .catch(() => [mid, [] as Unavailability[]] as [string, Unavailability[]]),
    ),
  );
  const unavByMember = new Map(unavPairs);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const nameById = new Map(cards.map((c) => [c.id, c.name]));

  return scoped.map((s, i) => {
    const assignments = details[i]?.assignments ?? [];
    const ev = eventById.get(s.eventId);
    return {
      schedule: s,
      ministryName: nameById.get(s.ministryId) ?? '—',
      hasConflict: assignments.some((a) => a.conflict),
      hasUnavailable:
        !!ev &&
        assignments.some((a) =>
          overlapsUnavailability(unavByMember.get(a.member.id) ?? [], ev.startsAt, ev.endsAt),
        ),
    };
  });
}

/**
 * Tela de Agenda (docs/design/agenda) — calendário mensal para todos os perfis,
 * com o sistema de indisponibilidade do próprio membro.
 *
 * Fontes reais: eventos (GET /eventos), minhas escalas publicadas
 * (GET /minhas-escalas → "escalado") e minhas indisponibilidades
 * (GET /indisponibilidades/minhas). O estado "escalado com conflito" do handoff
 * não é derivável aqui (o /minhas-escalas não expõe conflito ao membro), então o
 * calendário mostra só "escalado".
 *
 * VISÃO DE ADMIN: além disso, o admin vê as ESCALAS do dia no seu escopo
 * (ADMIN_GERAL: todas; ADMIN_MINISTERIO: dos ministérios em que participa), cada
 * uma com o sinal de conflito (âmbar) e de membro indisponível (vermelho).
 */
export default function AgendaPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [entries, setEntries] = useState<MemberScheduleEntry[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [adminSchedules, setAdminSchedules] = useState<AdminSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    // Janela ampla (~1 ano) para navegar os meses sem novo fetch.
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59).toISOString();
    const isAdmin = user?.role === 'ADMIN_GERAL' || user?.role === 'ADMIN_MINISTERIO';
    Promise.all([listEvents(), getMySchedule(from, to), listMyUnavailabilities()])
      .then(async ([evts, mine, unavs]) => {
        setEvents(evts);
        setEntries(mine.entries);
        setUnavailabilities(unavs);
        setAdminSchedules(isAdmin ? await loadAdminSchedules(evts) : []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user?.role]);

  const reloadUnavailabilities = () => {
    listMyUnavailabilities().then(setUnavailabilities).catch(() => {});
  };

  /** Eventos em que o usuário está escalado (por eventId). */
  const escaladoEventIds = useMemo(() => new Set(entries.map((e) => e.eventId)), [entries]);
  /** Eventos agrupados pelo dia local de início. */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      const key = dateKeyOf(ev.startsAt);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [events]);
  /** Indisponibilidade do usuário por dia (registro que começa naquele dia). */
  const unavByDate = useMemo(() => {
    const map = new Map<string, Unavailability>();
    for (const u of unavailabilities) map.set(dateKeyOf(u.startsAt), u);
    return map;
  }, [unavailabilities]);
  /** Escalas do admin agrupadas por evento. */
  const schedulesByEvent = useMemo(() => {
    const map = new Map<string, AdminSchedule[]>();
    for (const item of adminSchedules) {
      const list = map.get(item.schedule.eventId) ?? [];
      list.push(item);
      map.set(item.schedule.eventId, list);
    }
    return map;
  }, [adminSchedules]);
  /** Pior sinal do admin por dia: 'unavailable' > 'conflict' > null (para o calendário). */
  const adminIssueByDate = useMemo(() => {
    const map = new Map<string, 'unavailable' | 'conflict'>();
    for (const item of adminSchedules) {
      const ev = events.find((e) => e.id === item.schedule.eventId);
      if (!ev) continue;
      const key = dateKeyOf(ev.startsAt);
      const current = map.get(key);
      if (item.hasUnavailable) map.set(key, 'unavailable');
      else if (item.hasConflict && current !== 'unavailable') map.set(key, 'conflict');
    }
    return map;
  }, [adminSchedules, events]);

  /** 42 células (6 semanas) do mês em foco. */
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: { day: number; dateKey: string | null; inMonth: boolean }[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push({ day: 0, dateKey: null, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ day: d, dateKey: `${year}-${pad(month + 1)}-${pad(d)}`, inMonth: true });
    }
    while (list.length < 42) list.push({ day: 0, dateKey: null, inMonth: false });
    return list;
  }, [year, month]);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN_GERAL' || user.role === 'ADMIN_MINISTERIO';
  const todayKey = dateKeyOf(new Date().toISOString());

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDate(null);
  };

  const eventStatus = (ev: Event): 'scheduled' | 'open' =>
    escaladoEventIds.has(ev.id) ? 'scheduled' : 'open';
  const statusStyle = (status: 'scheduled' | 'open') =>
    status === 'scheduled'
      ? { background: '#1C7C8C', color: '#FFFFFF' }
      : { background: '#E7DFCB', color: '#5C5340' };

  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];
  const selectedUnav = selectedDate ? unavByDate.get(selectedDate) ?? null : null;

  const quickRemove = async () => {
    if (!selectedUnav) return;
    try {
      await removeUnavailability(selectedUnav.id);
      showToast('success', 'Indisponibilidade removida.');
      reloadUnavailabilities();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível remover.');
    }
  };

  return (
    <div>
      {/* Cabeçalho do mês + legenda. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => shiftMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition hover:bg-highlight"
          >
            ‹
          </button>
          <h2 className="min-w-[150px] text-center font-display text-base font-bold text-ink">
            {MONTHS[month]} {year}
          </h2>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => shiftMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition hover:bg-highlight"
          >
            ›
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted sm:ml-auto">
          <Legend color="#E7DFCB" label="Aberto" />
          <Legend color="#1C7C8C" label="Você escalado" />
          <Legend color="#FDEDEB" border="#F3C6BE" label="Indisponível" />
        </div>
      </div>

      {loading && <p className="text-[13.5px] text-muted">Carregando agenda...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Calendário. */}
          <div className="overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-2 text-center text-[11px] font-semibold text-faint">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((c, i) => {
                const dayEvents = c.dateKey ? eventsByDate.get(c.dateKey) ?? [] : [];
                const shown = dayEvents.slice(0, 3);
                const extra = dayEvents.length - shown.length;
                const unavailable = c.dateKey !== null && unavByDate.has(c.dateKey);
                const selected = c.dateKey !== null && c.dateKey === selectedDate;
                const isToday = c.dateKey === todayKey;
                const adminIssue = c.dateKey ? adminIssueByDate.get(c.dateKey) : undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!c.dateKey}
                    onClick={() => c.dateKey && setSelectedDate(selected ? null : c.dateKey)}
                    style={{
                      background: selected ? '#F5EFE2' : unavailable ? '#FDEDEB' : '#FFFFFF',
                      opacity: c.inMonth ? 1 : 0.4,
                      boxShadow: unavailable ? 'inset 0 0 0 1px #F3C6BE' : undefined,
                    }}
                    className="flex min-h-[64px] cursor-pointer flex-col gap-1 border-b border-r border-line p-1.5 text-left last:border-r-0 disabled:cursor-default sm:min-h-[92px]"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
                        style={{
                          background: isToday ? '#1C7C8C' : 'transparent',
                          color: isToday ? '#FFFFFF' : '#1A1A1A',
                          fontWeight: isToday ? 800 : 600,
                        }}
                      >
                        {c.inMonth ? c.day : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        {isAdmin && adminIssue && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: adminIssue === 'unavailable' ? '#C0392B' : '#8A6D1F' }}
                          />
                        )}
                        {unavailable && <span className="text-[11px] font-bold text-danger">✕</span>}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {shown.map((ev) => (
                        <span
                          key={ev.id}
                          className="truncate rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold"
                          style={statusStyle(eventStatus(ev))}
                        >
                          {ev.name}
                        </span>
                      ))}
                      {extra > 0 && <span className="text-[10px] font-semibold text-faint">+{extra} mais</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel do dia selecionado. */}
          {selectedDate && (
            <div className="mt-4 rounded-[14px] border border-line bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-bold capitalize text-ink">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </p>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  {selectedUnav ? (
                    <button
                      type="button"
                      onClick={quickRemove}
                      className="rounded-[10px] bg-danger px-3 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90"
                    >
                      Desfazer indisponibilidade
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalDate(selectedDate)}
                      className="rounded-[10px] border border-alert-border bg-alert-bg px-3 py-2 text-[12.5px] font-semibold text-danger transition hover:opacity-90"
                    >
                      Marcar indisponibilidade
                    </button>
                  )}
                </div>
              </div>

              {selectedEvents.length === 0 ? (
                <p className="text-[13px] text-muted">Nenhum evento neste dia.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedEvents.map((ev) => {
                    const status = eventStatus(ev);
                    const myChips = entries.filter((e) => e.eventId === ev.id);
                    // O membro está escalado E marcou indisponibilidade que cruza o
                    // horário deste evento (RN05, na visão dele): sinaliza o choque
                    // na própria escala. Só faz sentido quando ele está escalado aqui.
                    const clashingUnav =
                      myChips.length > 0
                        ? unavailabilities.filter(
                            (u) =>
                              new Date(u.startsAt).getTime() < new Date(ev.endsAt).getTime() &&
                              new Date(u.endsAt).getTime() > new Date(ev.startsAt).getTime(),
                          )
                        : [];
                    const unavReasons = clashingUnav
                      .map((u) => u.reason)
                      .filter((r): r is string => !!r && r.trim().length > 0)
                      .join('; ');
                    return (
                      <div key={ev.id} className="rounded-xl border border-line px-3.5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-ink">{ev.name}</p>
                          <span className="text-[12.5px] text-muted">
                            {timeLabel(ev.startsAt)}–{timeLabel(ev.endsAt)}
                          </span>
                          <span
                            className="ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={statusStyle(status)}
                          >
                            {status === 'scheduled' ? 'Você está escalado' : 'Aberto'}
                          </span>
                        </div>
                        {myChips.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {myChips.map((c) => (
                              <span
                                key={c.assignmentId}
                                className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                                style={{ background: '#E3F0F1', color: '#145F6B' }}
                              >
                                {c.ministryName} · {c.positionName}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Escalado, mas indisponível neste horário: aviso na escala. */}
                        {clashingUnav.length > 0 && (
                          <div
                            className="mt-2 flex items-start gap-1.5 rounded-[10px] border px-2.5 py-1.5"
                            style={{ borderColor: '#F3C6BE', background: '#FDEDEB' }}
                          >
                            <span
                              aria-hidden="true"
                              className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white"
                            >
                              !
                            </span>
                            <p className="text-[12px] font-semibold text-danger">
                              Você está escalado, mas marcou indisponibilidade neste horário
                              {unavReasons && (
                                <span className="font-normal text-alert-text"> — {unavReasons}</span>
                              )}
                            </p>
                          </div>
                        )}

                        {/* Escalas do dia (visão do admin), com conflito/indisponibilidade. */}
                        {isAdmin && (schedulesByEvent.get(ev.id) ?? []).length > 0 && (
                          <div className="mt-2.5 flex flex-col gap-1.5">
                            {(schedulesByEvent.get(ev.id) ?? []).map((sc) => (
                              <button
                                key={sc.schedule.id}
                                type="button"
                                onClick={() => navigate(`/escalas/${sc.schedule.id}`)}
                                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-left transition hover:bg-highlight"
                              >
                                <ScheduleStatusBadge status={sc.schedule.status} />
                                <span className="text-[12.5px] font-semibold text-ink">
                                  {sc.ministryName}
                                  {sc.schedule.name ? ` · ${sc.schedule.name}` : ''}
                                </span>
                                {sc.hasUnavailable && (
                                  <span className="whitespace-nowrap rounded-full bg-danger px-2 py-0.5 text-[10.5px] font-semibold text-white">
                                    Membro indisponível
                                  </span>
                                )}
                                {sc.hasConflict && (
                                  <span
                                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                                    style={{ background: '#FBF0D9', color: '#8A6D1F' }}
                                  >
                                    Conflito
                                  </span>
                                )}
                                <span className="ml-auto whitespace-nowrap text-[11px] text-faint">Ver →</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modalDate && (
        <UnavailabilityModal
          dateKey={modalDate}
          existing={unavByDate.get(modalDate) ?? null}
          onClose={() => setModalDate(null)}
          onSaved={reloadUnavailabilities}
        />
      )}
    </div>
  );
}

/** Item da legenda de cores. */
function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-[3px]"
        style={{ background: color, boxShadow: border ? `inset 0 0 0 1px ${border}` : undefined }}
      />
      {label}
    </span>
  );
}
