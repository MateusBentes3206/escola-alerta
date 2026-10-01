export type Perfil = 'ORIENTADOR' | 'RESPONSAVEL';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  perfil: Perfil;
}

/** O que pode sair da API: nunca inclui o hash da senha. */
export type UsuarioPublico = Omit<Usuario, 'senhaHash'>;

export function paraPublico({ senhaHash: _omitido, ...resto }: Usuario): UsuarioPublico {
  return resto;
}

/** Conteúdo do token JWT. Só o necessário para autorizar; nada de dado pessoal sensível. */
export interface TokenPayload {
  sub: string;      // id do usuário
  perfil: Perfil;
}
