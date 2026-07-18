import type { UserRole } from '@/services/types';

/**
 * O menu do layout base e o cabeçalho de cada tela, num lugar só
 * (docs/design/layout_sidebar/README.md).
 *
 * `roles` é o filtro GROSSO de navegação — decide o que aparece no menu e quais
 * rotas abrem. NÃO é a permissão real: quem decide é a API, e o front trata o 403
 * (Seção 4 do CLAUDE.md do web). Esconder um item é conveniência, nunca garantia.
 *
 * O menu do MEMBRO (Agenda, Escalas, Eventos) vem da tabela de atores do handoff
 * de Membros (docs/design/crud_membros/README.md) — a 2ª rodada dava os seis itens
 * a todos, o que era erro: a API responde 403 a um MEMBRO em cinco deles.
 *
 * ⚠️ Escalas e Eventos ainda dão 403 para o MEMBRO: as duas rotas são
 * `rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO')`. O menu já reflete a decisão de
 * produto; a API é que precisa alcançá-la (pendência 🔴 na Fase 8 do TASKS.md).
 * Enquanto isso, as telas são placeholders e ninguém sente.
 */
export interface NavItem {
  path: string;
  label: string;
  /** Cabeçalho da página (Sora 800, 22px no handoff). */
  title: string;
  subtitle: string;
  /** Quem enxerga o item no menu. */
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = ['ADMIN_GERAL', 'ADMIN_MINISTERIO', 'MEMBRO'];
const ADMINS: UserRole[] = ['ADMIN_GERAL', 'ADMIN_MINISTERIO'];

/** Ordem e textos conforme o handoff. */
export const NAV_ITEMS: NavItem[] = [
  {
    path: '/agenda',
    label: 'Agenda',
    title: 'Agenda',
    subtitle: 'Visão de calendário das escalas',
    // A única rota que um MEMBRO alcança hoje: GET /minhas-escalas é o único
    // endpoint de escala aberto a qualquer autenticado (RN04 — só PUBLICADA).
    roles: ALL_ROLES,
  },
  {
    path: '/escalas',
    label: 'Escalas',
    title: 'Escalas',
    subtitle: 'Designação de membros às funções em cada evento',
    // ⚠️ A API ainda dá 403 ao MEMBRO aqui (GET /escalas é rbac de admin). O menu
    // segue a decisão de produto — ele precisa ver as escalas do próprio
    // ministério; falta a API abrir com filtro por vínculo + PUBLICADA (RN04).
    roles: ALL_ROLES,
  },
  {
    path: '/eventos',
    label: 'Eventos',
    title: 'Eventos',
    subtitle: 'Calendário de eventos da instituição',
    // ⚠️ Mesma situação: GET /eventos é admin-only na API.
    roles: ALL_ROLES,
  },
  {
    path: '/ministerios',
    label: 'Ministérios',
    title: 'Ministérios',
    subtitle: 'Grupos e equipes da sua igreja',
    // Aberto ao MEMBRO (handoff v4): ele vê só os ministérios de que participa,
    // via GET /ministerios/cards (escopado no servidor). As telas de gestão de
    // membros/funções seguem admin-only.
    roles: ALL_ROLES,
  },
  {
    path: '/membros',
    label: 'Membros',
    title: 'Membros',
    subtitle: 'Pessoas com acesso ao Escacev',
    roles: ADMINS,
  },
  {
    path: '/funcoes',
    label: 'Funções',
    title: 'Funções',
    subtitle: 'Papéis dentro de cada ministério',
    roles: ADMINS,
  },
];

/** Primeira tela após o login — o handoff abre na Agenda, que todo perfil enxerga. */
export const DEFAULT_PATH = '/agenda';

export function navItemsFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function navItemByPath(path: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === path);
}

/** Rótulos do papel, como o handoff os escreve no rodapé da sidebar. */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_GERAL: 'Administrador geral',
  ADMIN_MINISTERIO: 'Administrador de grupo',
  MEMBRO: 'Membro',
};
