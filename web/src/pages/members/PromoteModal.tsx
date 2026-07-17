import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { setMembershipAdmin } from '@/services/memberships';
import type { Ministry } from '@/services/types';
import type { MemberRow } from './types';

/**
 * O admin de grupo promove alguém a administrador de um ministério DELE.
 *
 * Fluxo de dois passos (handoff v3): escolher o ministério, depois confirmar.
 * A confirmação existe porque a ação dá poder administrativo a outra pessoa — e
 * este modal, diferente da edição do admin geral, não tem como desfazer.
 *
 * A lista de ministérios já vem filtrada (ver `eligibleMinistries`): só os que o
 * ator administra, dos quais o membro participa, e onde ele ainda não é admin.
 * Nunca oferecer um ministério fora dessas três regras — a API responderia 403 ou
 * 404, mas a tela não deve chegar lá.
 */
export function PromoteModal({
  member,
  eligible,
  onClose,
  onPromoted,
}: {
  member: MemberRow;
  eligible: Ministry[];
  onClose: () => void;
  onPromoted: () => void;
}) {
  const [ministryId, setMinistryId] = useState(eligible[0]?.id ?? '');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const chosen = eligible.find((m) => m.id === ministryId);

  const promote = async () => {
    if (!ministryId) return;

    setSaving(true);
    try {
      await setMembershipAdmin(ministryId, member.id, true);
      showToast('success', `${member.name} agora administra ${chosen?.name}.`);
      onPromoted();
      onClose();
    } catch (error) {
      showToast(
        'error',
        error instanceof ApiError ? error.message : 'Não foi possível promover.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Promover a administrador" onClose={onClose}>
      {confirming ? (
        <>
          <div className="rounded-xl border border-alert-border bg-alert-bg px-3.5 py-3">
            <p className="text-[13px] leading-[1.5] text-alert-text">
              Tem certeza que deseja tornar <strong>{member.name}</strong> administrador de{' '}
              <strong>{chosen?.name}</strong>? A pessoa poderá gerenciar as escalas, as funções e
              os membros deste ministério. <strong>Essa ação não pode ser desfeita por aqui.</strong>
            </p>
          </div>
          <div className="mt-[22px] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition hover:bg-highlight"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={promote}
              disabled={saving}
              className="rounded-[10px] bg-danger px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Promovendo...' : 'Sim, promover'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-[13px] leading-[1.5] text-muted">
            Escolha em qual dos seus ministérios <strong className="text-ink">{member.name}</strong>{' '}
            passará a ser administrador.
          </p>

          <label htmlFor="promote-ministry" className="mb-1.5 block text-[12.5px] font-semibold text-muted">
            Ministério
          </label>
          <select
            id="promote-ministry"
            value={ministryId}
            onChange={(event) => setMinistryId(event.target.value)}
            className="mb-[22px] w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm"
          >
            {eligible.map((ministry) => (
              <option key={ministry.id} value={ministry.id}>
                {ministry.name}
              </option>
            ))}
          </select>

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
              onClick={() => setConfirming(true)}
              disabled={!ministryId}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              Continuar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
