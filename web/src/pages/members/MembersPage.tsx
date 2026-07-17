import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ROLE_LABELS } from '@/config/navigation';
import { PageActionSlotContext } from '@/hooks/pageActionContext';
import { initialsOf } from '@/hooks/useCurrentMember';
import { useAuth } from '@/hooks/useAuth';
import { useContext } from 'react';
import { MemberModal } from './MemberModal';
import { PromoteModal } from './PromoteModal';
import { useMembersData } from './useMembersData';
import {
  ROLE_TAG_CLASSES,
  STATUS_CLASSES,
  STATUS_LABELS,
  statusOf,
  type MemberRow,
} from './types';

const ALL = 'all';

/**
 * Tela de Membros (docs/design/crud_membros).
 *
 * | | ADMIN_GERAL | ADMIN_MINISTERIO |
 * |---|---|---|
 * | Vê | todos, com filtro por ministério | só os dos ministérios que administra |
 * | Convida | na instituição, escolhendo o perfil | para um ministério dele, sem perfil |
 * | Edita | sim | não |
 *
 * O MEMBRO não chega aqui: o item não está no menu dele e o ProtectedRoute barra
 * a URL. Quem garante mesmo é o `rbac` da API.
 */
export default function MembersPage() {
  const { user } = useAuth();
  const actionSlot = useContext(PageActionSlotContext);
  const [filter, setFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; member: MemberRow | null }>({
    open: false,
    member: null,
  });
  const [promoting, setPromoting] = useState<MemberRow | null>(null);

  const isGeneralAdmin = user?.role === 'ADMIN_GERAL';
  const { rows, ministries, loading, error, reload } = useMembersData(user!);

  /**
   * Onde o admin de grupo pode promover esta pessoa. As três regras do handoff,
   * juntas:
   *
   * 1. entre os ministérios que ELE administra (`ministries` já vem só com esses);
   * 2. dos quais o MEMBRO participa — não se administra o que não se frequenta;
   * 3. em que ele ainda NÃO é admin — senão a ação não faria nada.
   *
   * E nunca sobre um admin geral: ele já administra tudo.
   */
  const eligibleFor = (row: MemberRow) =>
    row.role === 'ADMIN_GERAL'
      ? []
      : ministries.filter((ministry) =>
          row.ministries.some((m) => m.id === ministry.id && !m.isAdmin),
        );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => filter === ALL || row.ministries.some((m) => m.id === filter))
      .filter(
        (row) =>
          !query ||
          row.name.toLowerCase().includes(query) ||
          row.email.toLowerCase().includes(query),
      );
  }, [rows, filter, search]);

  if (!user) return null;

  return (
    <div>
      {/* A ação primária mora no header do layout — a tela a injeta por portal. */}
      {actionSlot &&
        createPortal(
          <button
            type="button"
            onClick={() => setModal({ open: true, member: null })}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover"
          >
            <span className="text-base leading-none">+</span>Convidar membro
          </button>,
          actionSlot,
        )}

      {/* Filtro por ministério: só o admin geral tem mais de um escopo. A lista
          do admin de grupo já vem escopada do servidor. */}
      {isGeneralAdmin && ministries.length > 0 && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          {[{ id: ALL, name: 'Todos' }, ...ministries].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                filter === item.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink hover:bg-highlight'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nome ou e-mail"
        className="mb-4 w-full max-w-[320px] rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13.5px]"
      />

      {loading && <p className="text-[13.5px] text-muted">Carregando membros...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
          {rows.length === 0 ? 'Nenhum membro por aqui ainda.' : 'Nenhum membro encontrado.'}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visible.map((row) => {
          const status = statusOf(row);
          return (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5"
            >
              <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-highlight text-[13px] font-bold text-ink">
                {initialsOf(row.name)}
              </div>

              <div className="min-w-[160px] flex-1">
                <p className="text-sm font-bold text-ink">{row.name}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">{row.email}</p>
              </div>

              {/* Quebra para a linha de baixo: as tags variam de largura e não
                  podem empurrar as ações. */}
              <div className="order-3 flex basis-full flex-wrap items-center gap-1.5">
                {row.ministries.map((ministry) => {
                  // O "· admin" mostra ONDE a pessoa administra — é a informação
                  // que a tag de perfil não dava. Some para o ADMIN_GERAL: ele
                  // administra todos, e marcar um chip sugeriria que só aquele.
                  const showsAdmin = ministry.isAdmin && row.role !== 'ADMIN_GERAL';
                  return (
                    <span
                      key={ministry.id}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        showsAdmin ? 'bg-brand-soft text-brand' : 'bg-highlight text-muted'
                      }`}
                    >
                      {ministry.name}
                      {showsAdmin && <span className="font-bold"> · admin</span>}
                    </span>
                  );
                })}

                {/* Só o ADMIN_GERAL ganha tag de perfil. "Administrador de grupo"
                    seria redundante e pior: diria que a pessoa é admin sem dizer
                    DE QUÊ — os chips acima já dizem, com precisão. */}
                {row.role === 'ADMIN_GERAL' && (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${ROLE_TAG_CLASSES.ADMIN_GERAL}`}
                  >
                    {ROLE_LABELS.ADMIN_GERAL}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_CLASSES[status]}`}
                >
                  {STATUS_LABELS[status]}
                </span>
              </div>

              <div className="ml-auto flex flex-shrink-0 items-center gap-3.5 whitespace-nowrap">
                {isGeneralAdmin && (
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, member: row })}
                    className="text-[13px] font-semibold text-brand transition hover:text-brand-hover"
                  >
                    Editar
                  </button>
                )}

                {/* Só aparece quando há de fato o que promover — as três regras
                    juntas (ver eligibleFor). Sem elegível, o botão sumiria no
                    clique com um select vazio. */}
                {!isGeneralAdmin && eligibleFor(row).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPromoting(row)}
                    className="text-[13px] font-semibold text-brand transition hover:text-brand-hover"
                  >
                    Promover
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {promoting && (
        <PromoteModal
          member={promoting}
          eligible={eligibleFor(promoting)}
          onClose={() => setPromoting(null)}
          onPromoted={reload}
        />
      )}

      {modal.open && (
        <MemberModal
          member={modal.member}
          ministries={ministries}
          isGeneralAdmin={!!isGeneralAdmin}
          onClose={() => setModal({ open: false, member: null })}
          onSaved={reload}
        />
      )}
    </div>
  );
}
