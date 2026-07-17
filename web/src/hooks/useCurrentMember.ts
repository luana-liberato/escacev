import { useCallback, useEffect, useState } from 'react';
import { getMyMember } from '@/services/members';
import type { Member } from '@/services/types';

interface CurrentMemberState {
  member: Member | null;
  loading: boolean;
  /** Atualiza o nome já carregado, sem refetch — o PATCH /membros/me já devolveu o valor novo. */
  setName: (name: string) => void;
}

/**
 * O cadastro do usuário logado (`GET /membros/me`) — nome e e-mail, que o JWT não
 * carrega.
 *
 * NÃO propaga erro: o rodapé da sidebar é decoração de casca. Se a chamada
 * falhar, ele mostra só o papel (que vem do JWT) em vez de derrubar o app inteiro
 * — a tela que o usuário veio usar continua funcionando. Um 401 já derruba a
 * sessão pelo handler global do http.ts.
 */
export function useCurrentMember(): CurrentMemberState {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getMyMember()
      .then((data) => {
        if (active) setMember(data);
      })
      .catch(() => {
        if (active) setMember(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const setName = useCallback((name: string) => {
    setMember((current) => (current ? { ...current, name } : current));
  }, []);

  return { member, loading, setName };
}

/**
 * Iniciais para o avatar: primeira letra do primeiro e do último nome ("Ana
 * Souza" -> "AS"), como no handoff. Nome de uma palavra só rende uma letra.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
