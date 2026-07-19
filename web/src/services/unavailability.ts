import { http } from './http';
import type { Unavailability } from './types';

/**
 * Indisponibilidade (Unavailability) — o membro registra/lista/remove os PRÓPRIOS
 * períodos indisponíveis (RN05). member-scoped: o memberId vem do JWT.
 *
 * A API guarda um INTERVALO (startsAt/endsAt), não um "dia + allDay". A semântica
 * de "dia todo" / "período" e "uma por data" é montada na borda da UI (Agenda):
 * dia todo = 00:00–23:59 do dia; editar = remover o registro do dia e criar outro.
 */
export function listMyUnavailabilities(): Promise<Unavailability[]> {
  return http.get<Unavailability[]>('/indisponibilidades/minhas');
}

export interface CreateUnavailabilityInput {
  /** ISO 8601. */
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

/** Registra uma indisponibilidade do próprio membro. 400 se o término não for depois do início. */
export function createUnavailability(input: CreateUnavailabilityInput): Promise<Unavailability> {
  return http.post<Unavailability>('/indisponibilidades', input);
}

/** Remove uma indisponibilidade do próprio membro. */
export function removeUnavailability(id: string): Promise<null> {
  return http.del<null>(`/indisponibilidades/${id}`);
}

/** Indisponibilidades de um membro — consulta do ADMIN (ao montar a escala, RN05). */
export function listMemberUnavailabilities(memberId: string): Promise<Unavailability[]> {
  return http.get<Unavailability[]>(`/membros/${memberId}/indisponibilidades`);
}

/**
 * true se ALGUMA indisponibilidade se sobrepõe ao intervalo [startsAt, endsAt) do
 * evento — a mesma sobreposição estrita do motor de conflito (RN05). Cobre "dia
 * todo" (00:00–23:59 do dia envolve o evento) e período (só se os horários cruzam).
 */
export function overlapsUnavailability(
  items: Unavailability[],
  startsAt: string,
  endsAt: string,
): boolean {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  return items.some(
    (u) => new Date(u.startsAt).getTime() < end && new Date(u.endsAt).getTime() > start,
  );
}
