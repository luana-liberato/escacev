import type { UserRole } from '@/services/types';

/**
 * O menu do layout base e o cabeçalho de cada tela, num lugar só
 * (docs/design/layout_sidebar/README.md).
 *
 * `roles` é o filtro GROSSO de navegação — decide o que aparece no menu e quais
 * rotas abrem. NÃO é a permissão real: quem decide é a API, e o front trata o 403
 * (Seção 4 do CLAUDE.md do web). Esconder um item é conveniência, nunca garantia.
 *
 * DIVERGÊNCIA DELIBERADA DO HANDOFF: o protótipo declara o MESMO menu para os três
 * perfis ("nav é igual para os três nesta versão"), mas a API responde 403 a um
 * MEMBRO em cinco dos seis itens. Mostrar tudo a todos entregaria um menu onde
 * quase nada funciona. Decidido com a cliente: o membro não vê Ministérios,
 * Membros nem Funções.
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
    // PENDENTE NA API: o membro precisa ver as escalas do próprio ministério
    // (decisão da cliente), mas GET /escalas é rbac('ADMIN_GERAL',
    // 'ADMIN_MINISTERIO') — hoje ele leva 403. Enquanto a API não abrir com
    // filtro por vínculo + status PUBLICADA, o item fica só para admins.
    roles: ADMINS,
  },
  {
    path: '/eventos',
    label: 'Eventos',
    title: 'Eventos',
    subtitle: 'Lista de todas as escalas e eventos',
    // GET /eventos também é admin-only.
    roles: ADMINS,
  },
  {
    path: '/ministerios',
    label: 'Ministérios',
    title: 'Ministérios',
    subtitle: 'Grupos e equipes da sua igreja',
    roles: ADMINS,
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
