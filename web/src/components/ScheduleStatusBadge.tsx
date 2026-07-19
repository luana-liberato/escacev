import type { ScheduleStatus } from '@/services/types';

/**
 * Badge de status da escala. O wire usa o enum do Prisma (RASCUNHO/PUBLICADA);
 * aqui vira o rótulo em português com as cores do handoff (docs/design/crud_escalas).
 * Rascunho é neutro; Publicada é teal.
 */
export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const published = status === 'PUBLICADA';
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={
        published
          ? { backgroundColor: '#E3F0F1', color: '#145F6B' }
          : { backgroundColor: '#F5EFE2', color: '#6B6456' }
      }
    >
      {published ? 'Publicada' : 'Rascunho'}
    </span>
  );
}
