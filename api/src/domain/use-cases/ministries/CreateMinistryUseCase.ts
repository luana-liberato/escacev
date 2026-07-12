import { Ministry } from '../../entities/Ministry';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AppError } from '../../../shared/errors/AppError';

/** Dados de criação. institutionId vem do JWT (req.user), nunca do body. */
export interface CreateMinistryDTO {
  institutionId: string;
  name: string;
  description?: string | null;
}

/**
 * Cria um ministério na instituição do usuário autenticado.
 * Impede nome duplicado dentro da mesma instituição (comparação sem
 * distinção de maiúsculas, feita no repositório).
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class CreateMinistryUseCase {
  constructor(private readonly ministryRepo: MinistryRepository) {}

  async execute(dto: CreateMinistryDTO): Promise<Ministry> {
    // Valida e normaliza (trim do nome) antes de checar duplicidade.
    const ministry = Ministry.create(dto);

    const existing = await this.ministryRepo.findByName(ministry.name, ministry.institutionId);
    if (existing) {
      throw new AppError('Já existe um ministério com este nome nesta instituição', 409);
    }

    return this.ministryRepo.save(ministry);
  }
}
