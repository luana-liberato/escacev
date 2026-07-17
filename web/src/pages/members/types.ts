import type { UserRole } from '@/services/types';

/**
 * Uma linha da tela de Membros: o cadastro + os ministérios dele.
 *
 * A API não devolve isso pronto — `GET /membros` não traz vínculo nenhum. A
 * junção é feita na tela, a partir de `GET /ministerios/:id/membros` por
 * ministério (poucas chamadas), e não por membro (que seriam muitas).
 */
export interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  pending: boolean;
  /** `isAdmin` = administra ESTE ministério — diferente do perfil global `role`. */
  ministries: { id: string; name: string; isAdmin: boolean }[];
}

/**
 * O que a tag de status mostra. O handoff prevê só "Ativo" e "Convite pendente",
 * mas `active` e `pending` são independentes na API — quatro combinações. Sem o
 * terceiro estado, um membro DESATIVADO apareceria como "Ativo": a tag diria o
 * oposto da verdade. `GET /membros` não filtra inativos, então o caso aparece.
 *
 * Desativado prevalece: é o fato mais relevante sobre a pessoa.
 */
export type MemberStatus = 'active' | 'pending' | 'inactive';

export function statusOf(member: { active: boolean; pending: boolean }): MemberStatus {
  if (!member.active) return 'inactive';
  return member.pending ? 'pending' : 'active';
}

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Ativo',
  pending: 'Convite pendente',
  inactive: 'Desativado',
};

/** Cores do handoff; o "Desativado" reusa o tom neutro da tag de perfil Membro. */
export const STATUS_CLASSES: Record<MemberStatus, string> = {
  active: 'bg-brand-soft text-brand',
  pending: 'bg-pending-bg text-pending-fg',
  inactive: 'bg-role-membro-bg text-role-membro-fg',
};

export const ROLE_TAG_CLASSES: Record<UserRole, string> = {
  ADMIN_GERAL: 'bg-role-geral-bg text-role-geral-fg border-role-geral-fg',
  ADMIN_MINISTERIO: 'bg-role-grupo-bg text-role-grupo-fg border-role-grupo-fg',
  MEMBRO: 'bg-role-membro-bg text-role-membro-fg border-role-membro-fg',
};
