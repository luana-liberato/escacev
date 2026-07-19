import { useCallback, useEffect, useState } from 'react';
import { listMembers } from '@/services/members';
import { listMemberMinistries, listMinistryMembers } from '@/services/memberships';
import { listMinistries } from '@/services/ministries';
import type { AuthUser, Ministry } from '@/services/types';
import type { MemberRow } from './types';

interface MembersData {
  rows: MemberRow[];
  /** Ministérios que o ator pode oferecer: todos (ADMIN_GERAL) ou os que administra. */
  ministries: Ministry[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Carrega a tela de Membros conforme o perfil.
 *
 * **ADMIN_GERAL** vê todos: `GET /membros` + um `GET /ministerios/:id/membros`
 * por ministério, para montar os chips. São poucas chamadas (uma por ministério)
 * — o caminho por membro seria uma por linha.
 *
 * **ADMIN_MINISTERIO** vê só os membros dos ministérios que ADMINISTRA, e a lista
 * vem escopada do SERVIDOR: descobrimos os ministérios dele
 * (`GET /membros/:id/ministerios`, filtrando `isAdmin`) e listamos os membros de
 * cada um. Nunca chamamos `GET /membros` para ele — aquilo devolve a instituição
 * inteira, e filtrar aqui faria os dados dos outros trafegarem do mesmo jeito.
 *
 * Os CHIPS, porém, mostram TODOS os ministérios de cada pessoa — não só os do
 * escopo do admin. Como o escopo do ADMIN_MINISTERIO cobre apenas os ministérios
 * que administra, buscamos a lista completa de cada membro listado
 * (`GET /membros/:id/ministerios`, liberado a qualquer admin) para o chip revelar
 * também onde a pessoa atua fora desse escopo. É uma chamada por membro, mas a
 * lista do admin de grupo é pequena. O ADMIN_GERAL já monta chips completos (o
 * escopo dele é a instituição inteira), então não precisa dessa segunda passada.
 */
export function useMembersData(user: AuthUser): MembersData {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      const isGeneralAdmin = user.role === 'ADMIN_GERAL';

      // Quais ministérios este ator enxerga.
      const scope: Ministry[] = isGeneralAdmin
        ? await listMinistries()
        : (await listMemberMinistries(user.memberId))
            .filter((view) => view.isAdmin)
            .map((view) => ({
              id: view.id,
              name: view.name,
              description: view.description,
              createdAt: view.since,
            }));

      // memberId -> ministérios, montado a partir dos membros de cada ministério.
      // O isAdmin vem daqui: é a única fonte que diz quem administra o quê.
      const byMember = new Map<string, { id: string; name: string; isAdmin: boolean }[]>();
      const scoped = new Map<string, MemberRow>();

      for (const ministry of scope) {
        for (const view of await listMinistryMembers(ministry.id)) {
          const current = byMember.get(view.id) ?? [];
          byMember.set(view.id, [
            ...current,
            { id: ministry.id, name: ministry.name, isAdmin: view.isAdmin },
          ]);

          // Para o admin de grupo, estes JÁ são os membros visíveis — a view não
          // traz createdAt, e a tela não usa.
          if (!scoped.has(view.id)) {
            scoped.set(view.id, {
              id: view.id,
              name: view.name,
              email: view.email,
              role: view.role,
              active: view.active,
              pending: view.pending,
              ministries: [],
            });
          }
        }
      }

      const base: MemberRow[] = isGeneralAdmin
        ? (await listMembers()).map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            active: member.active,
            pending: member.pending,
            ministries: [],
          }))
        : [...scoped.values()];

      // Fonte dos chips. Para o ADMIN_GERAL o `byMember` (varrido sobre a
      // instituição inteira) já é completo. Para o ADMIN_MINISTERIO ele só cobre
      // os ministérios que administra, então buscamos a lista COMPLETA de cada
      // membro listado — assim o chip revela também onde a pessoa atua fora do
      // escopo do admin (a rota é liberada a qualquer admin).
      let ministriesByMember = byMember;
      if (!isGeneralAdmin) {
        const entries = await Promise.all(
          base.map(async (row) => {
            const views = await listMemberMinistries(row.id).catch(() => []);
            return [
              row.id,
              views.map((view) => ({ id: view.id, name: view.name, isAdmin: view.isAdmin })),
            ] as [string, { id: string; name: string; isAdmin: boolean }[]];
          }),
        );
        ministriesByMember = new Map(entries);
      }

      if (!active) return;
      setRows(base.map((row) => ({ ...row, ministries: ministriesByMember.get(row.id) ?? [] })));
      setMinistries(scope);
    };

    load()
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user.role, user.memberId, reloadKey]);

  return { rows, ministries, loading, error, reload };
}
