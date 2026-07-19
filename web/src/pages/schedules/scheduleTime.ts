/**
 * Helpers de data/período da tela de Escalas. Tudo lido no fuso LOCAL do usuário
 * (a API guarda UTC). O período (dia/semana/mês) filtra as escalas pela data de
 * INÍCIO do evento — a escala não tem data própria.
 */

export type PeriodMode = 'dia' | 'semana' | 'mes';

/** "YYYY-MM-DD" → "DD/MM/YYYY" (dia puro; sem Date, para não haver deslize de fuso). */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** "Dom, 20/07 · 19h00–21h00" (rótulo de data + faixa de horário do evento). */
export function formatEventWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateLabel = start
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const cap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const time = (d: Date) =>
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${cap} · ${time(start)}–${time(end)}`
    : `${cap} ${time(start)} → ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time(end)}`;
}

/** Domingo 00:00 da semana que contém `d` (semana começa no domingo, como o handoff). */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Avança/retrocede o âncora conforme o modo (dia ±1, semana ±7, mês ±1). */
export function shiftAnchor(anchor: Date, mode: PeriodMode, delta: number): Date {
  const x = new Date(anchor);
  if (mode === 'dia') x.setDate(x.getDate() + delta);
  else if (mode === 'semana') x.setDate(x.getDate() + delta * 7);
  else x.setMonth(x.getMonth() + delta);
  return x;
}

/** Rótulo textual completo do período em foco. */
export function periodLabel(anchor: Date, mode: PeriodMode): string {
  const longDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  if (mode === 'dia') return longDate(anchor);
  if (mode === 'semana') {
    const s = startOfWeek(anchor);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return `${longDate(s)} – ${longDate(e)}`;
  }
  const label = anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** true se a data do evento cai no período (dia/semana/mês) do âncora. */
export function inPeriod(startsAt: string, anchor: Date, mode: PeriodMode): boolean {
  const d = new Date(startsAt);
  if (mode === 'dia') return d.toDateString() === anchor.toDateString();
  if (mode === 'semana') {
    const s = startOfWeek(anchor);
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    return d >= s && d < e;
  }
  return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth();
}
