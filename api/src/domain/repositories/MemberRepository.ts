import { Member } from '../entities/Member';

/**
 * Abstração de persistência do Member. Use cases dependem desta interface,
 * nunca do PrismaClient diretamente (Seção 4.2 do CLAUDE.md).
 *
 * As buscas por instituição recebem sempre o institutionId (vindo do JWT no
 * controller), garantindo o isolamento por tenant já no MVP.
 */
export interface MemberRepository {
  /** Membro por id (sem filtro de tenant — o use case valida a instituição). */
  findById(id: string): Promise<Member | null>;
  /** Member já vinculado a uma Account. */
  findByAccountId(accountId: string): Promise<Member | null>;
  /** Membro correspondente ao e-mail dentro de uma instituição (checa duplicidade). */
  findByEmailAndInstitution(email: string, institutionId: string): Promise<Member | null>;
  /** Todos os membros de uma instituição. */
  findByInstitution(institutionId: string): Promise<Member[]>;
  /** Convite pendente (accountId nulo) correspondente ao e-mail. */
  findPendingByEmail(email: string): Promise<Member | null>;
  /** Persiste um novo Member. */
  save(member: Member): Promise<Member>;
  /** Atualiza nome, perfil e status ativo de um Member existente. */
  update(member: Member): Promise<Member>;
  /** Vincula a Account ao Member (aceite do convite) e retorna o Member atualizado. */
  linkAccount(memberId: string, accountId: string): Promise<Member>;
}
