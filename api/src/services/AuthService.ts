import { paraPublico, UsuarioPublico } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { IUsuarioRepository } from '../repositories/UsuarioRepository';
import { compararSenha, HASH_FICTICIO } from './senha';
import { gerarToken } from './token';

export class AuthService {
  // Recebe o repositório pelo construtor (injeção de dependência):
  // em produção é o PgUsuarioRepository; nos testes, um falso.
  constructor(private readonly usuarios: IUsuarioRepository) {}

  async login(email: string, senha: string): Promise<{ token: string; usuario: UsuarioPublico }> {
    const usuario = await this.usuarios.buscarPorEmail(email);

    // Compara mesmo se o usuário não existir (ver HASH_FICTICIO).
    const senhaOk = await compararSenha(senha, usuario?.senhaHash ?? HASH_FICTICIO);

    // Mesma mensagem para "e-mail não existe" e "senha errada": não revela qual dos dois falhou.
    if (!usuario || !senhaOk) {
      throw new AppError(401, 'E-mail ou senha inválidos.');
    }

    const token = gerarToken({ sub: usuario.id, perfil: usuario.perfil });
    return { token, usuario: paraPublico(usuario) };
  }

  async usuarioAtual(id: string): Promise<UsuarioPublico> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) throw new AppError(401, 'Usuário não encontrado.');
    return paraPublico(usuario);
  }
}
