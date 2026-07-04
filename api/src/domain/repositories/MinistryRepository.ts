import { Ministry } from '../entities/Ministry';

/**
 * Contagem das dependências que BLOQUEIAM a remoção de um ministério:
 * escalas (histórico de quem serviu) e funções já usadas em vagas de eventos
 * (a vaga pertence ao evento da instituição, fora do ministério).
 * As demais dependências (funções livres, compatibilidades e vínculos de
 * membros) são estruturais e caem em cascata no delete.
 */
export interface MinistryBlockingDependencies {
  schedules: number;
  functionsInUse: number;
}

/**
 * Abstração de persistência do Ministry. Use cases dependem desta interface,
 * nunca do PrismaClient diretamente (Seção 4.2 do CLAUDE.md).
 *
 * As buscas por instituição recebem sempre o institutionId (vindo do JWT no
 * controller), garantindo o isolamento por tenant já no MVP.
 */
export interface MinistryRepository {
  /** Ministério por id (sem filtro de tenant — o use case valida a instituição). */
  findById(id: string): Promise<Ministry | null>;
  /** Todos os ministérios de uma instituição. */
  findByInstitution(institutionId: string): Promise<Ministry[]>;
  /** Ministério com este nome dentro de uma instituição (checa duplicidade). */
  findByName(name: string, institutionId: string): Promise<Ministry | null>;
  /** Persiste um novo Ministry. */
  save(ministry: Ministry): Promise<Ministry>;
  /** Atualiza nome e descrição de um Ministry existente. */
  update(ministry: Ministry): Promise<Ministry>;
  /**
   * Remove o Ministry e sua estrutura numa transação: funções (com as
   * compatibilidades que as referenciam) e vínculos MembroMinisterio.
   * O use case bloqueia antes se houver dependências históricas/compartilhadas.
   */
  delete(id: string): Promise<void>;
  /** Conta escalas e funções em uso em vagas de eventos (bloqueiam a remoção). */
  countBlockingDependencies(ministryId: string): Promise<MinistryBlockingDependencies>;
}
