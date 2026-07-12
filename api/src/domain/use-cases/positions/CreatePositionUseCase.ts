import { Position } from '../../entities/Position';
import { PositionRepository } from '../../repositories/PositionRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface CreatePositionDTO {
  institutionId: string;
  actor: Actor;
  ministryId: string;
  name: string;
}

/**
 * Cria uma função dentro de um ministério. Valida que o ministério pertence à
 * instituição do usuário (tenant), que o ator administra aquele ministério
 * (Permissão Escopada) e impede nome de função duplicado DENTRO do mesmo
 * ministério — dois ministérios podem ter uma "Vocal" cada, o mesmo não.
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class CreatePositionUseCase {
  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: CreatePositionDTO): Promise<Position> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    // Valida e normaliza o nome pela entidade antes de checar duplicidade.
    const position = Position.create({ name: dto.name, ministryId: ministry.id });

    const existing = await this.positionRepo.findByNameInMinistry(ministry.id, position.name);
    if (existing) {
      throw new AppError('Já existe uma função com este nome neste ministério', 409);
    }

    return this.positionRepo.save(position);
  }
}
