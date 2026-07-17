import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { createMinistry, updateMinistry } from '@/services/ministries';

/**
 * Criar / Editar ministério. O mesmo modal serve os dois (handoff): Nome +
 * Descrição opcional.
 *
 * Quem chega aqui já passou pela permissão da tela — criar é só ADMIN_GERAL,
 * editar é ADMIN_GERAL ou admin do ministério. A API é a garantia final: 403 se
 * a checagem fina não bater, 409 no nome duplicado. A mensagem vem pronta dela.
 */
export function MinistryModal({
  ministry,
  onClose,
  onSaved,
}: {
  /** null = criar; preenchido = editar. */
  ministry: { id: string; name: string; description: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = ministry !== null;
  const [name, setName] = useState(ministry?.name ?? '');
  const [description, setDescription] = useState(ministry?.description ?? '');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const save = async () => {
    if (!name.trim()) {
      showToast('error', 'Informe o nome do ministério.');
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      if (editing) {
        await updateMinistry(ministry.id, payload);
        showToast('success', 'Ministério atualizado com sucesso.');
      } else {
        await createMinistry(payload);
        showToast('success', 'Ministério criado com sucesso.');
      }
      onSaved();
      onClose();
    } catch (error) {
      showToast(
        'error',
        error instanceof ApiError ? error.message : 'Não foi possível salvar o ministério.',
      );
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1.5 block text-[12.5px] font-semibold text-muted';
  const field = 'mb-3.5 w-full rounded-[10px] border border-line px-3 py-2.5 text-sm';

  return (
    <Modal title={editing ? 'Editar ministério' : 'Novo ministério'} onClose={onClose}>
      <label htmlFor="ministry-name" className={label}>
        Nome
      </label>
      <input
        id="ministry-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={field}
      />

      <label htmlFor="ministry-description" className={label}>
        Descrição <span className="font-normal text-faint">(opcional)</span>
      </label>
      <input
        id="ministry-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="mb-[22px] w-full rounded-[10px] border border-line px-3 py-2.5 text-sm"
      />

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
          onClick={save}
          disabled={saving}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </Modal>
  );
}
