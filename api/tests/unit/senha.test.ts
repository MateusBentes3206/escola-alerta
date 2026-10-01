import bcrypt from 'bcryptjs';
import { Usuario } from '../../src/domain/usuario';
import { AppError } from '../../src/errors/AppError';
import { IUsuarioRepository } from '../../src/repositories/UsuarioRepository';
import { AuthService } from '../../src/services/AuthService';
import { compararSenha, gerarHashSenha } from '../../src/services/senha';

// UT07 (RNF01): a senha em texto puro nunca deve ser persistida;
// apenas o hash deve ser gerado e comparado.
describe('UT07 - Hash de senha (bcrypt)', () => {
  it('gera um hash bcrypt diferente da senha original', async () => {
    const hash = await gerarHashSenha('minhaSenha!');
    expect(hash).not.toBe('minhaSenha!');
    expect(hash).not.toContain('minhaSenha!');
    expect(hash).toMatch(/^\$2[aby]\$10\$/); // formato bcrypt com custo 10
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const [h1, h2] = await Promise.all([gerarHashSenha('igual'), gerarHashSenha('igual')]);
    expect(h1).not.toBe(h2);
  });

  it('aceita a senha correta e rejeita a incorreta', async () => {
    const hash = await gerarHashSenha('correta');
    await expect(compararSenha('correta', hash)).resolves.toBe(true);
    await expect(compararSenha('errada', hash)).resolves.toBe(false);
  });
});

// AuthService testado com repositório falso: sem banco (benefício do padrão Repository).
describe('AuthService.login (unitário, repositório falso)', () => {
  const usuario: Usuario = {
    id: '00000000-0000-0000-0000-000000000001',
    nome: 'Camila Duarte',
    email: 'camila@escola.com.br',
    senhaHash: bcrypt.hashSync('senha123', 4),
    perfil: 'ORIENTADOR',
  };

  const repoFalso: IUsuarioRepository = {
    buscarPorEmail: async (email) => (email === usuario.email ? usuario : null),
    buscarPorId: async (id) => (id === usuario.id ? usuario : null),
    criar: async () => { throw new Error('não usado'); },
  };

  const service = new AuthService(repoFalso);

  it('retorna token e usuário sem o hash da senha', async () => {
    const r = await service.login(usuario.email, 'senha123');
    expect(r.token.split('.')).toHaveLength(3);
    expect(r.usuario).toEqual({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: 'ORIENTADOR' });
    expect(r.usuario).not.toHaveProperty('senhaHash');
  });

  it('usa a mesma mensagem para senha errada e e-mail inexistente', async () => {
    const senhaErrada = service.login(usuario.email, 'xxx').catch((e) => e);
    const emailInexistente = service.login('ninguem@x.com', 'senha123').catch((e) => e);
    const [e1, e2] = await Promise.all([senhaErrada, emailInexistente]);
    expect(e1).toBeInstanceOf(AppError);
    expect(e1.status).toBe(401);
    expect(e1.message).toBe(e2.message);
  });
});
