import bcrypt from 'bcryptjs';

// Custo 10 = ~2^10 rodadas. Bom equilíbrio entre segurança e tempo de resposta do login.
const CUSTO = 10;

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export function compararSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

// Hash "falso" usado quando o e-mail não existe: o login demora o mesmo tempo
// com ou sem usuário, então um atacante não descobre quais e-mails estão cadastrados.
export const HASH_FICTICIO = bcrypt.hashSync('nao-existe', CUSTO);
