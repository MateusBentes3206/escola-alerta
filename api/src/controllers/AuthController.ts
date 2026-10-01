import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService';

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

/**
 * Controller: só traduz HTTP <-> Service.
 * Valida a entrada, chama o service e devolve o status certo. Nada de regra de negócio aqui.
 */
export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response) => {
    const { email, senha } = loginSchema.parse(req.body); // erro de validação -> 400 no middleware
    const resultado = await this.service.login(email, senha);
    res.status(200).json(resultado);
  };

  me = async (req: Request, res: Response) => {
    const usuario = await this.service.usuarioAtual(req.usuario!.sub);
    res.json(usuario);
  };
}
