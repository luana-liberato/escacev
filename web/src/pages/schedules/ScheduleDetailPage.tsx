import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { getSchedule, getScheduleConflicts, publishSchedule } from '@/services/schedules';
import {
  addAssignments,
  removeAssignment,
  updateAssignment,
  type UpdateAssignmentResult,
} from '@/services/assignments';
import { listMinistryPositions } from '@/services/positions';
import { listMinistryMembers } from '@/services/memberships';
import { listMemberUnavailabilities, overlapsUnavailability } from '@/services/unavailability';
import { listEvents } from '@/services/events';
import { listMinistryCards } from '@/services/ministries';
import type {
  Event,
  MinistryMemberView,
  NeedsConfirmationAssignment,
  Position,
  ScheduleConflictsResult,
  ScheduleWithAssignments,
} from '@/services/types';
import { ScheduleStatusBadge } from '@/components/ScheduleStatusBadge';
import { formatDay, formatEventWhen } from './scheduleTime';

/**
 * Detalhe da escala (docs/design/crud_escalas) — leitura + gestão. Admins do
 * ministério adicionam/removem pessoas e publicam; os demais veem em leitura.
 *
 * Alocar passa pelo motor de conflito: a API responde 201 mesmo quando o item cai
 * em `needsConfirmation` (conflito RN01 e/ou indisponibilidade RN05) — isso NÃO é
 * erro, é o cartão âmbar "aguardando decisão"; reenviar com confirm=true escala
 * mesmo assim (a alocação nasce com selo "Conflito", RN03). Editar uma alocação
 * (trocar pessoa/função) reavalia da mesma forma, com o mesmo cartão âmbar.
 */

/** O ramo "aguardando decisão" da edição — reusa o shape do service. */
type EditPending = Extract<UpdateAssignmentResult, { status: 'needs_confirmation' }>;

export default function ScheduleDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<ScheduleWithAssignments | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [ministryName, setMinistryName] = useState('—');
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<MinistryMemberView[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [unavailableMemberIds, setUnavailableMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addMemberId, setAddMemberId] = useState('');
  const [addPositionId, setAddPositionId] = useState('');
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<NeedsConfirmationAssignment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMemberId, setEditMemberId] = useState('');
  const [editPositionId, setEditPositionId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editPending, setEditPending] = useState<EditPending | null>(null);

  const [review, setReview] = useState<ScheduleConflictsResult | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getSchedule(id), listEvents(), listMinistryCards()])
      .then(async ([schedule, events, cards]) => {
        setData(schedule);
        setEvent(events.find((e) => e.id === schedule.eventId) ?? null);
        const card = cards.find((c) => c.id === schedule.ministryId);
        setMinistryName(card?.name ?? '—');
        const manage = user?.role === 'ADMIN_GERAL' || (card?.isCurrentUserAdmin ?? false);
        setCanManage(manage);
        const ev = events.find((e) => e.id === schedule.eventId) ?? null;
        if (manage) {
          const [mems, poss] = await Promise.all([
            listMinistryMembers(schedule.ministryId),
            listMinistryPositions(schedule.ministryId),
          ]);
          setMembers(mems);
          setPositions(poss);

          // Indisponibilidade (RN05): quais alocados estão indisponíveis no
          // horário do evento — consulta só do admin (endpoint admin-only).
          if (ev) {
            const allocatedIds = [...new Set(schedule.assignments.map((a) => a.member.id))];
            const checks = await Promise.all(
              allocatedIds.map((mid) =>
                listMemberUnavailabilities(mid)
                  .then((list) => ({ mid, unavailable: overlapsUnavailability(list, ev.startsAt, ev.endsAt) }))
                  .catch(() => ({ mid, unavailable: false })),
              ),
            );
            setUnavailableMemberIds(new Set(checks.filter((c) => c.unavailable).map((c) => c.mid)));
          } else {
            setUnavailableMemberIds(new Set());
          }
        } else {
          setUnavailableMemberIds(new Set());
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a escala.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, user?.role]);

  /** Envia UM item ao lote. confirm=true reenvia após o alerta âmbar (RN03). */
  const submitAdd = async (confirm: boolean) => {
    if (!addMemberId || !addPositionId) {
      showToast('error', 'Selecione a pessoa e a função.');
      return;
    }
    setAdding(true);
    try {
      const result = await addAssignments(id, [
        { memberId: addMemberId, positionId: addPositionId, confirm },
      ]);
      if (result.created.length > 0) {
        showToast('success', 'Pessoa escalada com sucesso.');
        setAddMemberId('');
        setAddPositionId('');
        setPending(null);
        load();
      } else if (result.needsConfirmation.length > 0) {
        // Alerta (conflito/indisponibilidade): NÃO é erro — mostra o cartão âmbar.
        setPending(result.needsConfirmation[0]);
      } else if (result.failed.length > 0) {
        showToast('error', result.failed[0].reason);
        setPending(null);
      }
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível escalar.');
    } finally {
      setAdding(false);
    }
  };

  const doRemove = async (assignmentId: string) => {
    try {
      await removeAssignment(assignmentId);
      showToast('success', 'Pessoa removida da escala.');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível remover.');
    }
  };

  /** Abre a edição inline de uma alocação, pré-preenchida com os valores atuais. */
  const startEdit = (assignmentId: string, memberId: string, positionId: string) => {
    setEditingId(assignmentId);
    setEditMemberId(memberId);
    setEditPositionId(positionId);
    setEditPending(null);
    setDeleteConfirm(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditPending(null);
  };

  /** Salva a edição. confirm=true reenvia após o alerta âmbar (RN03). */
  const submitEdit = async (confirm: boolean) => {
    if (!editingId) return;
    if (!editMemberId || !editPositionId) {
      showToast('error', 'Selecione a pessoa e a função.');
      return;
    }
    setEditSaving(true);
    try {
      const result = await updateAssignment(editingId, {
        memberId: editMemberId,
        positionId: editPositionId,
        confirm,
      });
      if (result.status === 'applied') {
        showToast('success', 'Alocação atualizada com sucesso.');
        setEditingId(null);
        setEditPending(null);
        load();
      } else {
        // needs_confirmation: alerta, não erro — mostra o cartão âmbar.
        setEditPending(result);
      }
    } catch (err) {
      // 409 (duplicata), 400 (inválido) etc.: a mensagem vem pronta da API.
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível atualizar.');
    } finally {
      setEditSaving(false);
    }
  };

  const openReview = async () => {
    try {
      setReview(await getScheduleConflicts(id));
      setReviewOpen(true);
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível carregar os conflitos.');
    }
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      await publishSchedule(id);
      showToast('success', 'Escala publicada com sucesso.');
      navigate('/escalas');
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Não foi possível publicar.');
      setPublishing(false);
      setPublishOpen(false);
    }
  };

  if (!user) return null;

  const hasConflicts = data?.assignments.some((a) => a.conflict) ?? false;
  const isDraft = data?.status === 'RASCUNHO';
  const pendingMemberName = members.find((m) => m.id === addMemberId)?.name ?? 'A pessoa';

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/escalas')}
        className="mb-3 text-[13px] font-semibold text-brand transition hover:text-brand-hover"
      >
        ← Voltar para escalas
      </button>

      {loading && <p className="text-[13.5px] text-muted">Carregando escala...</p>}

      {error && (
        <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-3 text-[13px] text-alert-text">
          {error}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[17px] font-bold text-ink">{event?.name ?? '—'}</p>
                <ScheduleStatusBadge status={data.status} />
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {event ? formatEventWhen(event.startsAt, event.endsAt) : '—'} · {ministryName}
              </p>
              {data.date && (
                <p className="mt-0.5 text-[12.5px] text-faint">Dia {formatDay(data.date)}</p>
              )}
              {data.name && <p className="mt-0.5 text-[12.5px] text-faint">{data.name}</p>}
            </div>

            <div className="flex flex-shrink-0 flex-wrap gap-2">
              {hasConflicts && (
                <button
                  type="button"
                  onClick={openReview}
                  className="rounded-[10px] border px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                  style={{ borderColor: '#E6D3A3', background: '#FBF0D9', color: '#8A6D1F' }}
                >
                  Revisar conflitos
                </button>
              )}
              {canManage && isDraft && (
                <button
                  type="button"
                  onClick={() => setPublishOpen(true)}
                  className="rounded-[10px] bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-hover"
                >
                  Publicar
                </button>
              )}
            </div>
          </div>

          {data.assignments.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
              Nenhuma pessoa escalada ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.assignments.map((a) => {
                const editing = editingId === a.id;
                // Prioridade visual: indisponível (vermelho) > conflito (âmbar) > minha (teal).
                const unavailLook = unavailableMemberIds.has(a.member.id) && !editing;
                const conflictLook = a.conflict && !editing && !unavailLook;
                const isMine = a.member.id === user.memberId;
                const mineLook = isMine && !editing && !unavailLook && !a.conflict;
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5"
                    style={{
                      border: unavailLook
                        ? '1px solid #F3C6BE'
                        : conflictLook
                          ? '1px solid #E6D3A3'
                          : mineLook
                            ? '1px solid #1C7C8C'
                            : '1px solid #EAE2D4',
                      borderLeft: unavailLook
                        ? '4px solid #C0392B'
                        : conflictLook
                          ? '4px solid #8A6D1F'
                          : mineLook
                            ? '4px solid #1C7C8C'
                            : '1px solid #EAE2D4',
                      background: unavailLook
                        ? '#FDEDEB'
                        : conflictLook
                          ? '#FBF0D9'
                          : mineLook
                            ? '#F2F9F8'
                            : '#FFFFFF',
                    }}
                  >
                    {editing ? (
                      <div className="flex w-full flex-col gap-2.5">
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end">
                          <select
                            aria-label="Pessoa"
                            value={editMemberId}
                            onChange={(e) => setEditMemberId(e.target.value)}
                            className="w-full rounded-[10px] border border-line bg-white px-3 py-2 text-sm sm:min-w-[150px] sm:flex-1"
                          >
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label="Função"
                            value={editPositionId}
                            onChange={(e) => setEditPositionId(e.target.value)}
                            className="w-full rounded-[10px] border border-line bg-white px-3 py-2 text-sm sm:min-w-[130px] sm:flex-1"
                          >
                            {positions.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => submitEdit(false)}
                              disabled={editSaving}
                              className="flex-1 whitespace-nowrap rounded-[10px] bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60 sm:flex-none"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="flex-1 whitespace-nowrap rounded-[10px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink transition hover:bg-highlight sm:flex-none"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>

                        {editPending && (
                          <div
                            className="rounded-[12px] p-3.5"
                            style={{ border: '1px solid #E6D3A3', background: '#FBF0D9' }}
                          >
                            <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: '#8A6D1F' }}>
                              <span
                                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ background: '#8A6D1F' }}
                                aria-hidden="true"
                              >
                                !
                              </span>
                              {members.find((m) => m.id === editMemberId)?.name ?? 'A pessoa'} já tem
                              compromisso nesse horário
                            </p>
                            <ul className="mt-1.5 flex flex-col gap-1">
                              {editPending.conflicts.map((c) => (
                                <li key={c.assignmentId} className="text-[12px] text-ink">
                                  {c.eventName} · {c.ministryName} · {c.positionName}
                                  <span className="text-faint">
                                    {' '}
                                    — {formatEventWhen(c.startsAt, c.endsAt)}
                                  </span>
                                </li>
                              ))}
                              {editPending.unavailabilities.map((u) => (
                                <li key={u.id} className="text-[12px] text-ink">
                                  Indisponível no período{u.reason ? ` — ${u.reason}` : ''}
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2.5 flex justify-end">
                              <button
                                type="button"
                                onClick={() => submitEdit(true)}
                                disabled={editSaving}
                                className="rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                style={{ background: '#8A6D1F' }}
                              >
                                Editar mesmo assim
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {(unavailLook || a.conflict) && (
                          <span
                            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: unavailLook ? '#C0392B' : '#8A6D1F' }}
                            aria-hidden="true"
                          >
                            !
                          </span>
                        )}
                        <p
                          className="min-w-0 flex-1 text-sm font-bold"
                          style={{ color: unavailLook ? '#C0392B' : '#1A1A1A' }}
                        >
                          {a.member.name}
                        </p>
                        {isMine && (
                          <span
                            className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{ background: '#E3F0F1', color: '#145F6B' }}
                          >
                            Você
                          </span>
                        )}
                        <span className="whitespace-nowrap rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                          {a.position.name}
                        </span>
                        {unavailLook && (
                          <span className="whitespace-nowrap rounded-full border border-alert-border bg-white px-2.5 py-0.5 text-[11px] font-semibold text-danger">
                            Indisponível
                          </span>
                        )}
                        {a.conflict && (
                          <span
                            className="whitespace-nowrap rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ borderColor: '#E6D3A3', color: '#8A6D1F' }}
                          >
                            Conflito
                          </span>
                        )}

                        {canManage &&
                          (deleteConfirm === a.id ? (
                            <div className="flex w-full items-center justify-end gap-3.5 whitespace-nowrap sm:ml-auto sm:w-auto">
                              <button
                                type="button"
                                onClick={() => doRemove(a.id)}
                                className="-my-2 py-2 text-[13px] font-semibold text-danger transition hover:opacity-80"
                              >
                                Confirmar remoção
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(null)}
                                className="-my-2 py-2 text-[13px] font-semibold text-faint transition hover:text-muted"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex w-full items-center justify-end gap-3.5 whitespace-nowrap sm:ml-auto sm:w-auto">
                              <button
                                type="button"
                                onClick={() => startEdit(a.id, a.member.id, a.position.id)}
                                className="-my-2 py-2 text-[13px] font-semibold text-brand transition hover:text-brand-hover"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(a.id)}
                                className="-my-2 py-2 text-[13px] font-semibold text-faint transition hover:text-muted"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cartão âmbar de alerta (aguardando decisão) — conflito e/ou indisponibilidade. */}
          {pending && (
            <div
              className="mt-3 rounded-[12px] p-4"
              style={{ border: '1px solid #E6D3A3', background: '#FBF0D9' }}
            >
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: '#8A6D1F' }}>
                <span
                  className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: '#8A6D1F' }}
                  aria-hidden="true"
                >
                  !
                </span>
                {pendingMemberName} já tem compromisso nesse horário
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {pending.conflicts.map((c) => (
                  <li key={c.assignmentId} className="text-[12.5px] text-ink">
                    {c.eventName} · {c.ministryName} · {c.positionName}
                    <span className="text-faint"> — {formatEventWhen(c.startsAt, c.endsAt)}</span>
                  </li>
                ))}
                {pending.unavailabilities.map((u) => (
                  <li key={u.id} className="text-[12.5px] text-ink">
                    Indisponível no período{u.reason ? ` — ${u.reason}` : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-[10px] border border-line bg-white px-4 py-2 text-[12.5px] font-semibold text-ink transition hover:bg-highlight"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => submitAdd(true)}
                  disabled={adding}
                  className="rounded-[10px] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#8A6D1F' }}
                >
                  Escalar mesmo assim
                </button>
              </div>
            </div>
          )}

          {/* Painel de adicionar — só admins. */}
          {canManage && (
            <div className="mt-4 rounded-[14px] border border-line bg-white p-4">
              <p className="mb-2.5 text-[12.5px] font-semibold text-muted">Adicionar à escala</p>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end">
                <select
                  aria-label="Pessoa"
                  value={addMemberId}
                  onChange={(e) => setAddMemberId(e.target.value)}
                  className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm sm:min-w-[160px] sm:flex-1"
                >
                  <option value="">Pessoa…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Função"
                  value={addPositionId}
                  onChange={(e) => setAddPositionId(e.target.value)}
                  className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm sm:min-w-[140px] sm:flex-1"
                >
                  <option value="">Função…</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => submitAdd(false)}
                  disabled={adding}
                  className="w-full whitespace-nowrap rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60 sm:w-auto"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {reviewOpen && review && (
        <Modal title="Conflitos da escala" onClose={() => setReviewOpen(false)} maxWidth={460}>
          {review.conflicts.length === 0 ? (
            <p className="text-[13.5px] text-muted">Nenhum conflito no momento.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {review.conflicts.map((entry) => (
                <div
                  key={entry.assignment.id}
                  className="rounded-[12px] border p-3.5"
                  style={{ borderColor: '#E6D3A3', background: '#FBF0D9' }}
                >
                  <p className="text-[13.5px] font-bold" style={{ color: '#8A6D1F' }}>
                    {entry.assignment.member.name} · {entry.assignment.position.name}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">Sobrepõe:</p>
                  <ul className="mt-1 flex flex-col gap-1.5">
                    {entry.conflicts.map((c) => (
                      <li key={c.assignmentId} className="text-[12.5px] text-ink">
                        {c.eventName} · {c.ministryName} · {c.positionName}
                        <span className="text-faint"> — {formatEventWhen(c.startsAt, c.endsAt)}</span>
                        {c.existingHasPrecedence && (
                          <span
                            className="ml-1 inline-block whitespace-nowrap rounded-full border bg-white px-2 py-0.5 align-middle text-[10.5px] font-semibold"
                            style={{ color: '#8A6D1F', borderColor: '#E6D3A3' }}
                          >
                            tem prioridade
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition hover:bg-highlight"
            >
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {publishOpen && (
        <Modal title="Publicar escala" onClose={() => setPublishOpen(false)} maxWidth={400}>
          <p className="text-[13.5px] leading-relaxed text-muted">
            Ao publicar, a escala fica visível aos membros e os escalados são notificados. A
            publicação é <strong className="text-ink">definitiva</strong> — não dá para despublicar.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setPublishOpen(false)}
              className="rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition hover:bg-highlight"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={doPublish}
              disabled={publishing}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              {publishing ? 'Publicando...' : 'Publicar escala'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
