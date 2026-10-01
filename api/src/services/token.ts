import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { TokenPayload } from '../domain/usuario';
import { AppError } from '../errors/AppError';

export function gerarToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] });
}

export function verificarToken(token: string): TokenPayload {
  try {
    const decodificado = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    return { sub: String(decodificado.sub), perfil: decodificado.perfil };
  } catch {
    throw new AppError(401, 'Sessão inválida ou expirada. Faça login novamente.');
  }
}
