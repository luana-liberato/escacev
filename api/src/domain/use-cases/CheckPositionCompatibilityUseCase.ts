import { PositionCompatibilityRepository } from '../repositories/PositionCompatibilityRepository';

/**
 * Responde se duas funções são compatíveis: existe a linha canônica do par?
 * (RN02 — ausência de linha = incompatível por padrão.) O repositório ordena o
 * par internamente, então a ordem dos argumentos é irrelevante.
 *
 * Assinatura deliberadamente enxuta (dois ids → boolean, sem actor/tenant) para
 * ser INJETADO no motor de conflito na Fase 5 (RN01): lá os ids já vêm de
 * alocações do mesmo membro dentro do tenant, então revalidar instituição aqui
 * seria ruído. A semântica de "mesma função sobreposta" (id1 === id2) é do motor
 * de conflito, não daqui — como não existe linha canônica para um par de ids
 * iguais, este check simplesmente devolve false nesse caso.
 *
 * Dependência injetada via construtor (Seção 4.2).
 */
export class CheckPositionCompatibilityUseCase {
  constructor(private readonly compatibilityRepo: PositionCompatibilityRepository) {}

  async execute(positionAId: string, positionBId: string): Promise<boolean> {
    const pair = await this.compatibilityRepo.findByPair(positionAId, positionBId);
    return pair !== null;
  }
}
