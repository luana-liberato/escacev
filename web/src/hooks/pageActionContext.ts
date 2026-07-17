import { createContext } from 'react';

/**
 * O elemento do header onde a tela injeta a sua ação primária (o botão "+" do
 * handoff). O AppLayout desenha o espaço e publica o nó aqui; a tela renderiza
 * dentro dele via portal.
 *
 * É `null` no primeiro render — o DOM ainda não existe quando o filho renderiza.
 * Quem usa precisa tratar isso (`slot && createPortal(...)`).
 *
 * Assim o layout não precisa conhecer tela nenhuma, e cada tela decide se tem
 * ação e qual é.
 */
export const PageActionSlotContext = createContext<HTMLElement | null>(null);
