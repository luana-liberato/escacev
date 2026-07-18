import type { EventType } from '@/services/types';

/**
 * Apresentação dos tipos de evento. O wire usa os valores em inglês (Seção 6 do
 * CLAUDE.md do web: enums do Prisma/domínio viajam em EN); aqui ficam o rótulo em
 * português e as cores do chip. Ordem e cores conforme o handoff
 * (docs/design/crud_eventos/README.md).
 */
export interface EventTypeMeta {
  type: EventType;
  label: string;
  /** Fundo do chip. */
  bg: string;
  /** Texto do chip. */
  fg: string;
}

/** Os seis tipos, na ordem do handoff (também a ordem do select e dos filtros). */
export const EVENT_TYPES: EventTypeMeta[] = [
  { type: 'SERVICE', label: 'Culto', bg: '#E3F0F1', fg: '#145F6B' },
  { type: 'REHEARSAL', label: 'Ensaio', bg: '#EAF2E3', fg: '#4F7A3A' },
  { type: 'SPECIAL', label: 'Especial', bg: '#E6EDF9', fg: '#3E5C8C' },
  { type: 'MEETING', label: 'Reunião', bg: '#F5EFE2', fg: '#6B6456' },
  { type: 'COFFEE', label: 'Café', bg: '#F6E4D2', fg: '#9B5E33' },
  { type: 'CONFERENCE', label: 'Conferência', bg: '#EEE3F2', fg: '#7A4C8C' },
];

const BY_TYPE = new Map(EVENT_TYPES.map((meta) => [meta.type, meta]));

/** Metadados de um tipo; cai no neutro se vier um valor inesperado do wire. */
export function eventTypeMeta(type: EventType): EventTypeMeta {
  return BY_TYPE.get(type) ?? { type, label: type, bg: '#F5EFE2', fg: '#6B6456' };
}
