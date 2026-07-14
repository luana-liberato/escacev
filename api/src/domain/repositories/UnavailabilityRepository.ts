import { Unavailability } from '../entities/Unavailability';

/**
 * Abstração de persistência da indisponibilidade (Unavailability). Use cases
 * dependem desta interface, nunca do PrismaClient direto (Seção 4.2). É
 * member-scoped: o schema não tem institutionId — o escopo por membro (e, por
 * ele, por instituição) é garantido no use case, com o memberId vindo do JWT.
 */
export interface UnavailabilityRepository {
  /** Indisponibilidade por id (sem escopo — o use case valida a posse pelo membro). */
  findById(id: string): Promise<Unavailability | null>;
  /** Indisponibilidades de um membro, em ordem cronológica (início asc). */
  findByMember(memberId: string): Promise<Unavailability[]>;
  /**
   * Indisponibilidades do membro que SOBREPÕEM a janela [startsAt, endsAt]
   * (estrito: inicio < endsAt E fim > startsAt) — mesma semântica de sobreposição
   * do motor de conflito. Alimenta a integração da RN05 (alertar ao escalar
   * membro indisponível) na fase seguinte; usa o @@index([membroId, inicio, fim]).
   */
  findByMemberOverlapping(
    memberId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<Unavailability[]>;
  /** Persiste uma nova indisponibilidade. */
  save(unavailability: Unavailability): Promise<Unavailability>;
  /** Remove a indisponibilidade. */
  delete(id: string): Promise<void>;
}
