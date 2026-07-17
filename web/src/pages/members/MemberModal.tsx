import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import { inviteMember, updateMember } from '@/services/members';
import {
  inviteToMinistry,
  setMemberMinistries,
  type MemberMinistryLink,
} from '@/services/memberships';
import type { Ministry, UserRole } from '@/services/types';
import type { MemberRow } from './types';

interface Props {
  /** null = convidar; preenchido = editar. */
  member: MemberRow | null;
  /** Ministérios que o ator pode oferecer: todos (ADMIN_GERAL) ou os que administra. */
  ministries: Ministry[];
  isGeneralAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Convidar / Editar membro. Os dois fluxos de convite são DIFERENTES, e a
 * diferença é regra de negócio (Seção 1 do CLAUDE.md), não UI:
 *
 * - ADMIN_GERAL convida na INSTITUIÇÃO (`POST /membros`), sem ministério
 *   obrigatório.
 * - ADMIN_MINISTERIO convida SEMPRE para um ministério dele
 *   (`POST /ministerios/:id/membros/convite`) e nunca cria membro "solto". Como
 *   ele pode administrar VÁRIOS ministérios, o modal pede qual — o protótipo
 *   assume que ele tem um só.
 *
 * NENHUM dos dois escolhe perfil: todo convidado nasce MEMBRO. O
 * ADMIN_MINISTERIO é derivado de administrar algum ministério; o ADMIN_GERAL
 * ganhará botões próprios (handoff v3), fora do formulário.
 *
 * Editar é exclusivo do ADMIN_GERAL.
 */
export function MemberModal({ member, ministries, isGeneralAdmin, onClose, onSaved }: Props) {
  const editing = member !== null;
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  // Só leitura: o perfil não é editável por esta tela (ver o comentário no
  // formulário). Serve para esconder a marcação "admin" nos chips do ADMIN_GERAL.
  const role: UserRole = member?.role ?? 'MEMBRO';
  // Parte SEMPRE do estado real: a lista enviada é a fonte da verdade do
  // isAdmin, então um padrão errado aqui rebaixaria quem já administrava.
  const [links, setLinks] = useState<MemberMinistryLink[]>(
    member?.ministries.map((m) => ({ ministryId: m.id, isAdmin: m.isAdmin })) ?? [],
  );
  // Convite do admin de grupo: para qual ministério dele.
  const [targetMinistry, setTargetMinistry] = useState(ministries[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmingPromote, setConfirmingPromote] = useState(false);
  const { showToast } = useToast();
  const { user } = useAuth();

  /**
   * Quem pode ser promovido a administrador geral. Duas guardas:
   *
   * - NÃO em si mesmo. Um admin geral mexendo no próprio papel é a receita para
   *   se trancar para fora — e o alvo mais provável de um clique distraído.
   * - NÃO em quem já é. Promover é irreversível por aqui (o handoff v3 é
   *   explícito), então oferecer o botão a um admin geral sugeriria um "desfazer"
   *   que não existe.
   */
  const canPromoteToGeneral =
    editing && isGeneralAdmin && member.id !== user?.memberId && member.role !== 'ADMIN_GERAL';

  /** Entra ou sai do ministério. Ao sair, o papel de admin vai junto. */
  const toggleMinistry = (id: string) => {
    setLinks((current) =>
      current.some((l) => l.ministryId === id)
        ? current.filter((l) => l.ministryId !== id)
        : [...current, { ministryId: id, isAdmin: false }],
    );
  };

  /** Promove ou rebaixa dentro de um ministério já marcado. */
  const toggleAdmin = (id: string) => {
    setLinks((current) =>
      current.map((l) => (l.ministryId === id ? { ...l, isAdmin: !l.isAdmin } : l)),
    );
  };

  /**
   * Promove a administrador geral. É AÇÃO PRÓPRIA, não campo do formulário:
   * escreve na hora e fecha. Foi por isso que o select saiu — dar à pessoa o
   * poder sobre a instituição inteira não podia parecer editar um campo qualquer,
   * salvo junto com o nome.
   */
  const promoteToGeneral = async () => {
    if (!editing) return;

    setSaving(true);
    try {
      await updateMember(member.id, { role: 'ADMIN_GERAL' });
      showToast('success', `${member.name} agora é administrador geral.`);
      onSaved();
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

  const save = async () => {
    if (!name.trim() || (!editing && !email.trim())) {
      showToast('error', 'Preencha nome e e-mail para continuar.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        // Duas escritas distintas: o cadastro e os vínculos. Os ministérios vão
        // numa chamada só — o servidor calcula o diff e aplica em transação.
        await updateMember(member.id, { name: name.trim() });
        await setMemberMinistries(member.id, links);
        showToast('success', 'Membro atualizado com sucesso.');
      } else if (isGeneralAdmin) {
        await inviteMember({ name: name.trim(), email: email.trim() });
        showToast('success', 'Convite enviado com sucesso.');
      } else {
        if (!targetMinistry) {
          showToast('error', 'Selecione o ministério do convite.');
          setSaving(false);
          return;
        }
        await inviteToMinistry(targetMinistry, { name: name.trim(), email: email.trim() });
        showToast('success', 'Convite enviado com sucesso.');
      }
      onSaved();
      onClose();
    } catch (error) {
      // A mensagem da API vem pronta e em português — inclusive o 409 de e-mail
      // duplicado e o 403 da permissão escopada.
      showToast(
        'error',
        error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.',
      );
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1.5 block text-[12.5px] font-semibold text-muted';
  const field = 'mb-3.5 w-full rounded-[10px] border border-line px-3 py-2.5 text-sm';

  return (
    <Modal title={editing ? 'Editar membro' : 'Convidar membro'} onClose={onClose}>
      <label htmlFor="member-name" className={label}>
        Nome
      </label>
      <input
        id="member-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={field}
      />

      <label htmlFor="member-email" className={label}>
        E-mail
      </label>
      {editing ? (
        <>
          {/* Nunca editável: o e-mail é a chave que liga o convite à conta
              Google, e o PUT /membros/:id sequer aceita o campo. */}
          <div className="mb-1.5 w-full rounded-[10px] border border-line bg-highlight px-3 py-2.5 text-sm text-muted">
            {email}
          </div>
          <p className="mb-3.5 text-[11.5px] text-faint">
            E-mail não pode ser alterado após a ativação do membro.
          </p>
        </>
      ) : (
        <input
          id="member-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={field}
        />
      )}

      {/*
        NÃO existe campo de perfil aqui, e isso é deliberado:

        - "Administrador de grupo" é DERIVADO de administrar algum ministério
          (marcação nos chips abaixo) — não é algo que se digita.
        - "Administrador geral" é decisão grande demais para um select no meio do
          formulário, onde promover alguém a dono da instituição pareceria editar
          um campo qualquer. O handoff (v3) prevê botões próprios, com confirmação:
          "Promover a administrador geral" e "Rebaixar para Membro". Enquanto eles
          não existem, o perfil não é editável por esta tela.
      */}
      {!isGeneralAdmin && (
        !editing && (
          <>
            <label htmlFor="member-ministry" className={label}>
              Ministério
            </label>
            <select
              id="member-ministry"
              value={targetMinistry}
              onChange={(event) => setTargetMinistry(event.target.value)}
              className={`${field} bg-white`}
            >
              {ministries.map((ministry) => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.name}
                </option>
              ))}
            </select>
          </>
        )
      )}

      {/* Chips só na edição: no convite ainda não há vínculo a editar. */}
      {editing && (
        <>
          <span className={label}>Ministérios</span>
          <p className="mb-2 text-[11.5px] text-faint">
            {role === 'ADMIN_GERAL'
              ? 'Onde participa e pode ser escalado. Como administrador geral, já administra todos.'
              : 'Clique para incluir. Nos incluídos, marque “admin” — quem administra algum ministério vira Administrador de grupo.'}
          </p>
          <div className="mb-[22px] flex flex-wrap gap-2">
            {ministries.map((ministry) => {
              const link = links.find((l) => l.ministryId === ministry.id);
              const selected = link !== undefined;
              return (
                // Contêiner, não botão: um botão dentro de outro é HTML inválido.
                // São dois botões irmãos dentro de uma casca com cara de chip.
                // Teal quando selecionado, conforme o handoff. NÃO é preto: preto
                // é o chip de FILTRO (navegação); aqui é escolha, e o padrão do
                // modal é a cor primária.
                <span
                  key={ministry.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 text-[12.5px] font-semibold transition ${
                    selected
                      ? 'border-brand bg-brand text-white pr-1'
                      : 'border-line bg-white pr-3 text-ink hover:bg-highlight'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMinistry(ministry.id)}
                    className="py-0.5"
                    aria-pressed={selected}
                  >
                    {ministry.name}
                  </button>

                  {/* Some para o ADMIN_GERAL: ele já administra todos pelo papel
                      global, e marcar "admin" no chip sugeriria que administra só
                      aquele. */}
                  {selected && role !== 'ADMIN_GERAL' && (
                    <button
                      type="button"
                      onClick={() => toggleAdmin(ministry.id)}
                      aria-pressed={link.isAdmin}
                      title={
                        link.isAdmin
                          ? `Administra ${ministry.name} — clique para rebaixar`
                          : `Clique para tornar administrador de ${ministry.name}`
                      }
                      // Sobre o chip teal, a marcação ligada usa o BRANCO com
                      // texto teal — invertendo o chip. Teal sobre teal
                      // desapareceria. Desligada, fica um branco translúcido:
                      // legível, mas claramente inativa.
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide transition ${
                        link.isAdmin
                          ? 'bg-white text-brand'
                          : 'bg-white/20 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      admin
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </>
      )}

      {canPromoteToGeneral &&
        (confirmingPromote ? (
          // Guarda de confirmação: a ação é irreversível por aqui, então o texto
          // diz exatamente isso — e o botão de confirmar é o vermelho, não o teal.
          <div className="mb-4 rounded-xl border border-alert-border bg-alert-bg px-3.5 py-3">
            <p className="text-[13px] leading-[1.5] text-alert-text">
              Promover <strong>{member.name}</strong> a administrador geral? A pessoa passa a
              administrar a instituição inteira. <strong>Esta ação não pode ser desfeita por
              aqui.</strong>
            </p>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingPromote(false)}
                className="rounded-[10px] border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink transition hover:bg-highlight"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={promoteToGeneral}
                disabled={saving}
                className="rounded-[10px] bg-danger px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Promovendo...' : 'Sim, promover'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingPromote(true)}
            className="mb-4 w-full rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:bg-highlight"
          >
            Promover a administrador geral
          </button>
        ))}

      <div className="mt-2 flex justify-end gap-2.5">
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
          {saving ? 'Salvando...' : editing ? 'Salvar' : 'Enviar convite'}
        </button>
      </div>
    </Modal>
  );
}
