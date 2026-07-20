import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { createEvent, updateEvent } from '@/services/events';
import type { Event, EventType } from '@/services/types';
import { EVENT_TYPES } from './eventTypes';

/**
 * Criar / Editar evento (docs/design/crud_eventos) — form direto, sem passo de
 * confirmação. Data e hora ficam em campos separados para o início e o término,
 * então um evento pode terminar em outro dia (o domínio só exige término > início).
 *
 * Quem chega aqui já passou pela permissão da tela (os dois admins gerem o
 * calendário). A API é a garantia final: 400 no intervalo inválido, e a mensagem
 * dela vem pronta para exibir.
 */
export function EventModal({
  event,
  defaultDate,
  onClose,
  onSaved,
}: {
  /** null = criar; preenchido = editar. */
  event: Event | null;
  /** Dia "YYYY-MM-DD" que pré-preenche início/término AO CRIAR (ex.: dia clicado
   *  na Agenda). Ignorado na edição, em que as datas vêm do próprio evento. */
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = event !== null;
  const start = splitIso(event?.startsAt);
  const end = splitIso(event?.endsAt);

  const [name, setName] = useState(event?.name ?? '');
  const [type, setType] = useState<EventType>(event?.type ?? 'SERVICE');
  const [startDate, setStartDate] = useState(start.date || (defaultDate ?? ''));
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date || (defaultDate ?? ''));
  const [endTime, setEndTime] = useState(end.time);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();

  /**
   * Ao preencher uma das datas, espelha na outra QUANDO ela ainda está vazia — a
   * maioria dos eventos começa e termina no mesmo dia, então o usuário digita a
   * data uma vez e só ajusta os dois horários. Nunca sobrescreve uma data já
   * informada (inclusive na edição, em que as duas já vêm preenchidas), para não
   * atrapalhar o evento que de fato vira o dia.
   */
  const onStartDateChange = (value: string) => {
    setStartDate(value);
    if (value && !endDate) setEndDate(value);
  };
  const onEndDateChange = (value: string) => {
    setEndDate(value);
    if (value && !startDate) setStartDate(value);
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Informe o nome do evento.');
      return;
    }
    if (!startDate || !startTime || !endDate || !endTime) {
      setError('Preencha o início e o término do evento.');
      return;
    }
    const startsAt = new Date(`${startDate}T${startTime}`);
    const endsAt = new Date(`${endDate}T${endTime}`);
    if (endsAt.getTime() <= startsAt.getTime()) {
      setError('O término deve ser depois do início.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        type,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
      if (editing) {
        await updateEvent(event.id, payload);
        showToast('success', 'Evento atualizado com sucesso.');
      } else {
        await createEvent(payload);
        showToast('success', 'Evento criado com sucesso.');
      }
      onSaved();
      onClose();
    } catch (err) {
      // A API é a dona da mensagem — mantém o modal aberto para o ajuste.
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o evento.');
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1.5 block text-[12.5px] font-semibold text-muted';
  const field = 'w-full rounded-[10px] border border-line px-3 py-2.5 text-sm';

  return (
    <Modal title={editing ? 'Editar evento' : 'Novo evento'} onClose={onClose} maxWidth={400}>
      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-alert-border bg-alert-bg px-3.5 py-3">
          <span className="mt-px flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
            !
          </span>
          <p className="text-[13px] leading-relaxed text-alert-text">{error}</p>
        </div>
      )}

      <label htmlFor="event-name" className={label}>
        Nome do evento
      </label>
      <input
        id="event-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`${field} mb-3.5`}
      />

      <label htmlFor="event-type" className={label}>
        Tipo
      </label>
      <select
        id="event-type"
        value={type}
        onChange={(e) => setType(e.target.value as EventType)}
        className={`${field} mb-3.5 bg-white`}
      >
        {EVENT_TYPES.map((meta) => (
          <option key={meta.type} value={meta.type}>
            {meta.label}
          </option>
        ))}
      </select>

      <div className="mb-3.5 flex gap-2.5">
        <div className="min-w-0 flex-1">
          <label htmlFor="event-start-date" className={label}>
            Início — data
          </label>
          <input
            id="event-start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={field}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="event-start-time" className={label}>
            Início — hora
          </label>
          <input
            id="event-start-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div className="mb-[22px] flex gap-2.5">
        <div className="min-w-0 flex-1">
          <label htmlFor="event-end-date" className={label}>
            Término — data
          </label>
          <input
            id="event-end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={field}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="event-end-time" className={label}>
            Término — hora
          </label>
          <input
            id="event-end-time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={field}
          />
        </div>
      </div>

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
          {saving ? 'Salvando...' : editing ? 'Salvar evento' : 'Criar evento'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Quebra um ISO (UTC, vindo da API) nos campos LOCAIS de data e hora que os
 * inputs `type="date"`/`type="time"` esperam. Local de propósito: o usuário
 * pensa no horário do evento no fuso dele, não em UTC. Vazio → campos vazios.
 */
function splitIso(iso: string | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
