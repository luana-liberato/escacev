import { useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { createSchedule } from '@/services/schedules';
import type { Event } from '@/services/types';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Chave de dia local (YYYY-MM-DD) de um Date. */
function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Todos os dias LOCAIS que o evento ocupa, do início ao fim (inclusive). Um evento
 * multi-dia (ex.: uma conferência de sex a dom) ocupa vários dias — todos devem
 * ficar marcados/selecionáveis no calendário, não só o dia de início.
 */
function spannedDateKeys(startsAt: string, endsAt: string): string[] {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/**
 * Modal "Nova escala" (docs/design/crud_escalas). Escolhe ministério, depois um
 * DIA com evento no mini-calendário, depois o evento daquele dia, e um rótulo
 * opcional. Cria a escala (RASCUNHO) e abre o detalhe.
 */
export function CreateScheduleModal({
  ministries,
  events,
  onClose,
  onCreated,
}: {
  ministries: { id: string; name: string }[];
  events: Event[];
  onClose: () => void;
  onCreated: (scheduleId: string) => void;
}) {
  const { showToast } = useToast();
  const today = new Date();

  const [ministryId, setMinistryId] = useState(ministries[0]?.id ?? '');
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [eventId, setEventId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Dias com ao menos um evento — cada evento marca TODOS os dias que ocupa. */
  const eventDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      for (const key of spannedDateKeys(e.startsAt, e.endsAt)) set.add(key);
    }
    return set;
  }, [events]);
  /** Eventos que OCUPAM o dia selecionado (não só os que começam nele). */
  const eventsOnSelected = useMemo(
    () =>
      selectedDate
        ? events.filter((e) => spannedDateKeys(e.startsAt, e.endsAt).includes(selectedDate))
        : [],
    [events, selectedDate],
  );

  /** 42 células (6 semanas) do mês em foco, com marcação de dia-com-evento/selecionado. */
  const weeks = useMemo(() => {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const firstWeekday = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: { day: number; dateKey: string | null; inMonth: boolean }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: 0, dateKey: null, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateKey: `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`, inMonth: true });
    }
    while (cells.length < 42) cells.push({ day: 0, dateKey: null, inMonth: false });

    const rows: { key: string; cells: typeof cells }[] = [];
    for (let i = 0; i < 42; i += 7) rows.push({ key: `w${i}`, cells: cells.slice(i, i + 7) });
    return rows;
  }, [calYear, calMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setEventId(''); // trocar de dia zera o evento escolhido
  };

  const save = async () => {
    if (!ministryId) {
      setError('Selecione o ministério.');
      return;
    }
    if (!selectedDate) {
      setError('Selecione uma data no calendário.');
      return;
    }
    if (!eventId) {
      setError('Selecione o evento.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const schedule = await createSchedule({
        ministryId,
        eventId,
        name: name.trim() || undefined,
        date: selectedDate, // o dia escolhido no calendário fixa a escala (multi-dia)
      });
      showToast('success', 'Escala criada com sucesso.');
      onCreated(schedule.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a escala.');
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1.5 block text-[12.5px] font-semibold text-muted';
  const field = 'w-full rounded-[10px] border border-line px-3 py-2.5 text-sm bg-white';

  return (
    <Modal title="Nova escala" onClose={onClose} maxWidth={420}>
      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-alert-border bg-alert-bg px-3.5 py-3">
          <span className="mt-px flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
            !
          </span>
          <p className="text-[13px] leading-relaxed text-alert-text">{error}</p>
        </div>
      )}

      {/* Mini-calendário: só dias com evento são clicáveis. */}
      <span className={label}>Data do evento</span>
      <div className="mb-4 rounded-[12px] border border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => shiftMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-highlight"
          >
            ‹
          </button>
          <span className="text-[13px] font-semibold text-ink">
            {MONTHS[calMonth]} {calYear}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => shiftMonth(1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-highlight"
          >
            ›
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-faint">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flatMap((row) =>
            row.cells.map((c, i) => {
              const hasEvent = c.dateKey !== null && eventDateKeys.has(c.dateKey);
              const selected = c.dateKey !== null && c.dateKey === selectedDate;
              return (
                <button
                  key={`${row.key}-${i}`}
                  type="button"
                  disabled={!hasEvent}
                  onClick={() => c.dateKey && selectDate(c.dateKey)}
                  style={{
                    background: selected ? '#1C7C8C' : hasEvent ? '#E3F0F1' : 'transparent',
                    color: selected ? '#FFFFFF' : hasEvent ? '#145F6B' : '#1A1A1A',
                    opacity: c.inMonth ? 1 : 0.35,
                  }}
                  className={`flex h-9 items-center justify-center rounded-lg text-[12.5px] ${
                    hasEvent ? 'cursor-pointer font-bold' : 'cursor-default font-medium'
                  }`}
                >
                  {c.inMonth ? c.day : ''}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <label htmlFor="schedule-event" className={label}>
        Evento
      </label>
      {selectedDate ? (
        <select
          id="schedule-event"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className={`${field} mb-4`}
        >
          <option value="">Selecione o evento…</option>
          {eventsOnSelected.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="mb-4 text-[12.5px] text-faint">
          Selecione uma data no calendário para escolher o evento.
        </p>
      )}

      <label htmlFor="schedule-ministry" className={label}>
        Ministério
      </label>
      <select
        id="schedule-ministry"
        value={ministryId}
        onChange={(e) => setMinistryId(e.target.value)}
        className={`${field} mb-4`}
      >
        {ministries.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <label htmlFor="schedule-name" className={label}>
        Nome da escala <span className="font-normal text-faint">(opcional)</span>
      </label>
      <input
        id="schedule-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex.: Berçário, Sala 1…"
        className={`${field} mb-[22px]`}
      />

      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition hover:bg-highlight"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? 'Criando...' : 'Criar escala'}
        </button>
      </div>
    </Modal>
  );
}
