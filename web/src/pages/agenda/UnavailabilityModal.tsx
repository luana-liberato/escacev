import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { createUnavailability, removeUnavailability } from '@/services/unavailability';
import type { Unavailability } from '@/services/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Hora local "HH:MM" de um ISO. */
function localTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Deriva o estado do form a partir de um registro existente (dia todo é inferido). */
function fromExisting(u: Unavailability | null): { allDay: boolean; startTime: string; endTime: string } {
  if (!u) return { allDay: true, startTime: '08:00', endTime: '12:00' };
  const start = localTime(u.startsAt);
  const end = localTime(u.endsAt);
  const allDay = start === '00:00' && end === '23:59';
  return { allDay, startTime: allDay ? '08:00' : start, endTime: allDay ? '12:00' : end };
}

/** "quarta-feira, 21 de julho" (dia local do dateKey "YYYY-MM-DD"). */
function dayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/**
 * Modal de indisponibilidade (docs/design/agenda) — marca/edita/remove a
 * indisponibilidade do próprio membro num DIA. Padrão "dia todo"; pode restringir
 * a um período (dois horários). Editar substitui (remove o registro do dia e cria
 * outro), refletindo a semântica "uma por data" sobre a API de intervalo.
 */
export function UnavailabilityModal({
  dateKey,
  existing,
  onClose,
  onSaved,
}: {
  dateKey: string;
  existing: Unavailability | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const initial = fromExisting(existing);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const startsAt = new Date(`${dateKey}T${allDay ? '00:00:00' : startTime}`);
    const endsAt = new Date(`${dateKey}T${allDay ? '23:59:59' : endTime}`);
    if (endsAt.getTime() <= startsAt.getTime()) {
      showToast('error', 'O término deve ser depois do início.');
      return;
    }
    setSaving(true);
    try {
      // "Editar substitui": remove o registro do dia antes de criar o novo.
      if (existing) await removeUnavailability(existing.id);
      await createUnavailability({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
      showToast('success', 'Indisponibilidade salva.');
      onSaved();
      onClose();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await removeUnavailability(existing.id);
      showToast('success', 'Indisponibilidade removida.');
      onSaved();
      onClose();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível remover.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-[10px] border border-line px-3 py-2.5 text-sm';

  return (
    <Modal title="Indisponibilidade" onClose={onClose} maxWidth={380}>
      <p className="mb-1 text-[13px] font-semibold capitalize text-ink">{dayLabel(dateKey)}</p>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        Por padrão vale o dia todo; ajuste o período se for indisponível só em parte dele.
      </p>

      <button
        type="button"
        onClick={() => setAllDay((v) => !v)}
        className="mb-3.5 flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-white px-3 py-2.5 text-left text-[13.5px] font-semibold text-ink transition hover:bg-highlight"
      >
        <span className="text-base leading-none">{allDay ? '☑' : '☐'}</span>
        Dia todo
      </button>

      {!allDay && (
        <div className="mb-4 flex gap-2.5">
          <div className="min-w-0 flex-1">
            <label htmlFor="unav-start" className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              De
            </label>
            <input
              id="unav-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={field}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="unav-end" className="mb-1.5 block text-[12.5px] font-semibold text-muted">
              Até
            </label>
            <input
              id="unav-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={field}
            />
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-2.5">
        {existing && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="mr-auto rounded-[10px] px-2 py-2.5 text-[13.5px] font-semibold text-danger transition hover:opacity-80 disabled:opacity-60"
          >
            Remover
          </button>
        )}
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
          className="rounded-[10px] bg-danger px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}
