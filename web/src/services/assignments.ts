import { http } from './http';
import type {
  AddAssignmentsResult,
  AssignmentItem,
  ConflictDetail,
  Unavailability,
} from './types';

/**
 * Alocações (Assignment) — pessoa + função dentro de uma escala. Escrita é escopo
 * de ministério (a API garante com 403). O MEMBRO não alcança estas rotas.
 */

/**
 * Adiciona um lote de alocações à escala. O corpo é um ARRAY CRU
 * (`[{ memberId, positionId, confirm? }]`), NÃO envelopado em `{ items }`.
 *
 * Responde 201 mesmo quando nada foi criado: conflito (RN01) e indisponibilidade
 * (RN05) voltam em `needsConfirmation` — NÃO são erro. Reenviar o MESMO item com
 * `confirm: true` cria mesmo assim.
 */
export function addAssignments(
  scheduleId: string,
  items: AssignmentItem[],
): Promise<AddAssignmentsResult> {
  return http.post<AddAssignmentsResult>(`/escalas/${scheduleId}/alocacoes`, items);
}

/** Campos da edição unitária: troca a pessoa, a função, ou ambas. */
export interface UpdateAssignmentInput {
  memberId?: string;
  positionId?: string;
  /** Reenvia após o alerta âmbar para aplicar cientemente (conflito/indisponibilidade). */
  confirm?: boolean;
}

/**
 * Resposta do PATCH /alocacoes/:id (200 em ambos os casos):
 *  - `applied` → a edição foi aplicada (a alocação já está com os novos valores);
 *  - `needs_confirmation` → alerta (conflito/indisponibilidade), NÃO aplicado —
 *    reenviar com `confirm: true` aplica mesmo assim. Não é erro.
 * Erros irrecuperáveis (409 duplicata, 400 inválido, 403, 404) vêm como ApiError.
 */
export type UpdateAssignmentResult =
  | {
      status: 'applied';
      id: string;
      scheduleId: string;
      memberId: string;
      positionId: string;
      conflict: boolean;
      createdAt: string;
    }
  | {
      status: 'needs_confirmation';
      conflicts: ConflictDetail[];
      unavailabilities: Unavailability[];
    };

/** Edita uma alocação (troca pessoa e/ou função). Ver UpdateAssignmentResult. */
export function updateAssignment(
  id: string,
  input: UpdateAssignmentInput,
): Promise<UpdateAssignmentResult> {
  return http.patch<UpdateAssignmentResult>(`/alocacoes/${id}`, input);
}

/** Remove uma alocação da escala. */
export function removeAssignment(id: string): Promise<null> {
  return http.del<null>(`/alocacoes/${id}`);
}
