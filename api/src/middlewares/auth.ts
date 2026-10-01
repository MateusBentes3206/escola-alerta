import { NextFunction, Request, Response } from 'express';
import { Perfil, TokenPayload } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { verificarToken } from '../services/token';

// Acrescenta req.usuario ao tipo do Express
declare global {
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

/** Exige o header "Authorization: Bearer <token>" válido. */
export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de acesso não informado.');
  }
  req.usuario = verificarToken(token);
  next();
}

/** Usar depois de autenticar(). Ex.: router.post('/alunos', autenticar, exigirPerfil('ORIENTADOR'), ...) */
export function exigirPerfil(...perfis: Perfil[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      throw new AppError(403, 'Você não tem permissão para esta ação.');
    }
    next();
  };
}
