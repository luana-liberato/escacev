import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { updateMyName } from '@/services/members';

/**
 * "Meu perfil" — o usuário corrige o próprio nome. Todos os perfis, conforme o
 * handoff: o nome do cadastro é o que o admin digitou no convite, e sem isto
 * quem foi cadastrado errado dependeria de um ADMIN_GERAL.
 *
 * Consome o PATCH /membros/me, que só aceita o nome — perfil e status não são
 * editáveis por aqui nem por engano.
 */
export function ProfileModal({
  currentName,
  onClose,
  onSaved,
}: {
  currentName: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const save = async () => {
    if (!name.trim()) {
      showToast('error', 'Informe um nome válido.');
      return;
    }

    setSaving(true);
    try {
      const member = await updateMyName(name.trim());
      onSaved(member.name);
      showToast('success', 'Nome atualizado com sucesso.');
      onClose();
    } catch (error) {
      // A mensagem vem pronta da API, em português (Seção 2 do CLAUDE.md do web).
      showToast('error', error instanceof ApiError ? error.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Meu perfil" onClose={onClose}>
      <label htmlFor="profile-name" className="mb-1.5 block text-[12.5px] font-semibold text-muted">
        Nome
      </label>
      <input
        id="profile-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
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
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}
