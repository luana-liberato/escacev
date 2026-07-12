import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { CreateMemberUseCase } from '../CreateMemberUseCase';
import { ListMembersUseCase } from '../ListMembersUseCase';
import { GetMemberUseCase } from '../GetMemberUseCase';
import { UpdateMemberUseCase } from '../UpdateMemberUseCase';
import { DeactivateMemberUseCase } from '../DeactivateMemberUseCase';

/**
 * Fake em memória do MemberRepository — cobre entidade + orquestração dos use
 * cases isoladamente (nível unitário, sem banco). Métodos ligados ao fluxo de
 * Account (findByAccountId/findPendingByEmail/linkAccount) existem para satisfazer
 * o contrato; não são exercidos por estes use cases.
 */
class FakeMemberRepository implements MemberRepository {
  members: Member[] = [];

  async findById(id: string): Promise<Member | null> {
    return this.members.find((m) => m.id === id) ?? null;
  }
  async findByAccountId(accountId: string): Promise<Member | null> {
    return this.members.find((m) => m.accountId === accountId) ?? null;
  }
  async findByEmailAndInstitution(email: string, institutionId: string): Promise<Member | null> {
    return (
      this.members.find((m) => m.email === email && m.institutionId === institutionId) ?? null
    );
  }
  async findByInstitution(institutionId: string): Promise<Member[]> {
    return this.members.filter((m) => m.institutionId === institutionId);
  }
  async findPendingByEmail(email: string): Promise<Member | null> {
    return this.members.find((m) => m.email === email && m.accountId === null) ?? null;
  }
  async save(member: Member): Promise<Member> {
    this.members.push(member);
    return member;
  }
  async update(member: Member): Promise<Member> {
    this.members = this.members.map((m) => (m.id === member.id ? member : m));
    return member;
  }
  async linkAccount(memberId: string, accountId: string): Promise<Member> {
    const member = this.members.find((m) => m.id === memberId)!;
    const linked = Member.restore({ ...member, accountId });
    return this.update(linked);
  }
}

const INST = 'i1';
const base = { institutionId: INST, name: 'João Silva', email: 'joao@example.com' };

describe('CreateMemberUseCase', () => {
  it('cria um membro (convite) com accountId nulo e perfil padrão', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);

    expect(member.id).toBeTruthy();
    expect(member.accountId).toBeNull();
    expect(member.role).toBe('MEMBRO');
    expect(repo.members).toHaveLength(1);
  });

  it('rejeita e-mail duplicado na mesma instituição (409)', async () => {
    const repo = new FakeMemberRepository();
    const useCase = new CreateMemberUseCase(repo);
    await useCase.execute(base);

    await expect(useCase.execute({ ...base, name: 'Outro' })).rejects.toMatchObject({
      statusCode: 409,
    });
    // duplicidade é case-insensitive: e-mail é normalizado para minúsculas
    await expect(useCase.execute({ ...base, email: 'JOAO@example.com' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.members).toHaveLength(1);
  });

  it('permite o mesmo e-mail em instituições diferentes', async () => {
    const repo = new FakeMemberRepository();
    const useCase = new CreateMemberUseCase(repo);
    await useCase.execute(base);

    const outra = await useCase.execute({ ...base, institutionId: 'i2' });
    expect(outra.institutionId).toBe('i2');
    expect(repo.members).toHaveLength(2);
  });
});

describe('ListMembersUseCase', () => {
  it('lista só os membros da instituição do usuário (isolamento por tenant)', async () => {
    const repo = new FakeMemberRepository();
    const create = new CreateMemberUseCase(repo);
    await create.execute(base);
    await create.execute({ ...base, email: 'maria@example.com', name: 'Maria' });
    await create.execute({ ...base, institutionId: 'i2', email: 'alheio@example.com' });

    const list = await new ListMembersUseCase(repo).execute({ institutionId: INST });
    expect(list).toHaveLength(2);
    expect(list.every((m) => m.institutionId === INST)).toBe(true);
  });
});

describe('GetMemberUseCase', () => {
  it('404 quando o membro é de outra instituição (não vaza outro tenant)', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);

    await expect(
      new GetMemberUseCase(repo).execute({ id: member.id, institutionId: 'i2' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404 quando o id não existe', async () => {
    const repo = new FakeMemberRepository();
    await expect(
      new GetMemberUseCase(repo).execute({ id: 'nao-existe', institutionId: INST }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UpdateMemberUseCase', () => {
  it('atualiza nome e perfil do membro do próprio tenant', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);

    const updated = await new UpdateMemberUseCase(repo).execute({
      id: member.id,
      institutionId: INST,
      name: 'João Atualizado',
      role: 'ADMIN_MINISTERIO',
    });

    expect(updated.name).toBe('João Atualizado');
    expect(updated.role).toBe('ADMIN_MINISTERIO');
  });

  it('404 ao tentar atualizar membro de outra instituição', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);

    await expect(
      new UpdateMemberUseCase(repo).execute({ id: member.id, institutionId: 'i2', name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DeactivateMemberUseCase', () => {
  it('desativa via soft delete (ativo = false), preservando o registro', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);

    const deactivated = await new DeactivateMemberUseCase(repo).execute({
      id: member.id,
      institutionId: INST,
    });

    expect(deactivated.active).toBe(false);
    expect(repo.members).toHaveLength(1); // não removeu fisicamente
  });

  it('é idempotente: membro já inativo é retornado como está', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);
    const deactivate = new DeactivateMemberUseCase(repo);

    await deactivate.execute({ id: member.id, institutionId: INST });
    const again = await deactivate.execute({ id: member.id, institutionId: INST });
    expect(again.active).toBe(false);
  });

  it('404 ao desativar membro de outra instituição', async () => {
    const repo = new FakeMemberRepository();
    const member = await new CreateMemberUseCase(repo).execute(base);

    await expect(
      new DeactivateMemberUseCase(repo).execute({ id: member.id, institutionId: 'i2' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
