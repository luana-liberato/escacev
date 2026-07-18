import { useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/http';
import {
  removeCompatibility,
  setCompatibility,
  type CompatibilityPair,
} from '@/services/compatibility';
import { createPosition, updatePosition, type InstitutionPosition } from '@/services/positions';

interface WritableMinistry {
  id: string;
  name: string;
}

interface Props {
  /** null = criar; preenchido = editar. */
  position: InstitutionPosition | null;
  /** Todas as funções da instituição — os toggles de compatibilidade mostram todas. */
  allPositions: InstitutionPosition[];
  /** Pares compatíveis existentes (para inicializar os toggles ao editar). */
  pairs: CompatibilityPair[];
  /** Ministérios em que o ator pode criar função (todos, ou os que administra). */
  ministries: WritableMinistry[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Criar / Editar função, com a compatibilidade embutida — fluxo de 2 passos
 * (handoff v5):
 *  1. Formulário: nome, ministério, e a lista de toggles "pode ser exercida junto".
 *  2. Confirmação: resumo do que a função vai poder acumular.
 *
 * A compatibilidade é DE PADRÃO INCOMPATÍVEL: só os toggles marcados viram pares;
 * todo o resto fica em conflito. O banner de aviso no passo 1 deixa isso explícito.
 *
 * O ministério NÃO é editável ao editar: o `PUT /funcoes/:id` só muda o nome —
 * mover uma função entre ministérios não é operação suportada.
 */
export function PositionModal({
  position,
  allPositions,
  pairs,
  ministries,
  onClose,
  onSaved,
}: Props) {
  const editing = position !== null;
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [name, setName] = useState(position?.name ?? '');
  const [ministryId, setMinistryId] = useState(position?.ministryId ?? ministries[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  /** Ids das funções marcadas como compatíveis com esta. Inicia do estado real. */
  const initialCompatible = useMemo(() => {
    if (!editing) return new Set<string>();
    const set = new Set<string>();
    for (const pair of pairs) {
      if (pair.positionAId === position.id) set.add(pair.positionBId);
      else if (pair.positionBId === position.id) set.add(pair.positionAId);
    }
    return set;
  }, [editing, pairs, position]);

  const [compatible, setCompatible] = useState<Set<string>>(initialCompatible);

  // Todas as funções menos a própria (não faz sentido combinar consigo mesma).
  const others = useMemo(
    () => allPositions.filter((p) => p.id !== position?.id),
    [allPositions, position],
  );

  const visibleOthers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return others.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [others, search]);

  const toggle = (id: string) => {
    setCompatible((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToConfirm = () => {
    if (!name.trim()) {
      setError('Informe o nome da função.');
      return;
    }
    if (!ministryId) {
      setError('Selecione o ministério da função.');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  /** Nomes das funções marcadas, para o resumo do passo 2. */
  const compatibleNames = useMemo(
    () => others.filter((p) => compatible.has(p.id)).map((p) => p.name),
    [others, compatible],
  );

  const save = async () => {
    setSaving(true);
    try {
      // 1. Grava a função e descobre o id de destino dos pares.
      const targetId = editing
        ? (await updatePosition(position.id, name.trim())).id
        : (await createPosition(ministryId, name.trim())).id;

      // 2. Aplica o diff de compatibilidade. Sem endpoint em lote: uma chamada
      //    por par que mudou. Idempotente dos dois lados, mas mandamos só o diff.
      const before = initialCompatible;
      const after = compatible;
      const toAdd = [...after].filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !after.has(id));

      for (const otherId of toAdd) await setCompatibility(targetId, otherId);
      for (const otherId of toRemove) await removeCompatibility(targetId, otherId);

      showToast('success', editing ? 'Função atualizada com sucesso.' : 'Função criada com sucesso.');
      onSaved();
      onClose();
    } catch (err) {
      showToast(
        'error',
        err instanceof ApiError ? err.message : 'Não foi possível salvar a função.',
      );
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1.5 block text-[12.5px] font-semibold text-muted';
  const field = 'w-full rounded-[10px] border border-line px-3 py-2.5 text-sm';
  const ministryName = ministries.find((m) => m.id === ministryId)?.name ?? position?.ministryName;

  return (
    <Modal title={editing ? 'Editar função' : 'Nova função'} onClose={onClose} maxWidth={460}>
      {step === 'form' ? (
        <>
          {error && (
            <div
              role="alert"
              className="mb-3.5 rounded-[10px] border border-alert-border bg-alert-bg px-3.5 py-2.5 text-[13px] text-alert-text"
            >
              {error}
            </div>
          )}

          <label htmlFor="position-name" className={label}>
            Nome da função
          </label>
          <input
            id="position-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`${field} mb-3.5`}
          />

          <label htmlFor="position-ministry" className={label}>
            Ministério
          </label>
          {editing ? (
            // Fixo na edição: o PUT não move a função entre ministérios.
            <div className="mb-3.5 w-full rounded-[10px] border border-line bg-highlight px-3 py-2.5 text-sm text-muted">
              {ministryName}
            </div>
          ) : (
            <select
              id="position-ministry"
              value={ministryId}
              onChange={(event) => setMinistryId(event.target.value)}
              className={`${field} mb-3.5 bg-white`}
            >
              {ministries.map((ministry) => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.name}
                </option>
              ))}
            </select>
          )}

          {/* O aviso do padrão-incompatível — o ponto contra-intuitivo do domínio. */}
          <div className="mb-3.5 rounded-[10px] border border-alert-border bg-alert-bg px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-alert-text">
            Por padrão, funções não marcadas abaixo <strong>não podem</strong> ser exercidas
            pela mesma pessoa no mesmo evento.
          </div>

          <label className={label}>
            Marque as funções que podem ser exercidas em um mesmo evento com{' '}
            <strong className="text-ink">“{name.trim() || 'esta função'}”</strong>
          </label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar função"
            className={`${field} mb-2`}
          />

          <div className="mb-[22px] max-h-[280px] overflow-y-auto rounded-[10px] border border-line">
            {visibleOthers.length === 0 ? (
              <p className="px-3.5 py-4 text-center text-[13px] text-muted">
                {others.length === 0
                  ? 'Nenhuma outra função na instituição.'
                  : 'Nenhuma função encontrada.'}
              </p>
            ) : (
              visibleOthers.map((p) => {
                const on = compatible.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-2 border-b border-line px-3.5 py-2.5 text-left last:border-b-0 hover:bg-highlight"
                  >
                    {/* Nome trunca com reticências; o chip do ministério não
                        encolhe. Antes eram spans inline: num nome longo o texto
                        quebrava em várias linhas no celular e empurrava o chip. */}
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{p.name}</span>
                      <span className="flex-shrink-0 rounded-full bg-highlight px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {p.ministryName}
                      </span>
                    </span>
                    {/* Toggle pill 42x24, teal quando ativo (handoff). */}
                    <span
                      className={`relative h-6 w-[42px] flex-shrink-0 rounded-full transition ${
                        on ? 'bg-brand' : 'bg-line'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                          on ? 'left-[19px]' : 'left-0.5'
                        }`}
                      />
                    </span>
                  </button>
                );
              })
            )}
          </div>

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
              onClick={goToConfirm}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover"
            >
              Continuar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm font-bold text-ink">{name.trim()}</p>
          <p className="mb-[22px] text-[13px] leading-[1.6] text-muted">
            {compatibleNames.length > 0 ? (
              <>
                Poderá ser exercida junto com:{' '}
                <strong className="text-ink">{compatibleNames.join(', ')}</strong>. Todas as
                demais funções continuam em conflito com ela.
              </>
            ) : (
              'Nenhuma outra função foi marcada — ela entrará em conflito com todas as demais.'
            )}
          </p>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition hover:bg-highlight"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
