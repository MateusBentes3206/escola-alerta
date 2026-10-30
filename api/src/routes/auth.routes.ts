import { Router } from 'express';
import { authService, cadastroFamiliaService } from '../container';
import { AuthController } from '../controllers/AuthController';
import { autenticar } from '../middlewares/auth';

// Montagem das camadas (Repository -> Service) fica em container.ts
const authController = new AuthController(authService);

export const authRoutes = Router();
authRoutes.post('/login', authController.login);
authRoutes.get('/me', autenticar, authController.me);

// Cadastro do responsável com os filhos (público). Responde como o login: já entra logado.
authRoutes.post('/cadastro', async (req, res) => {
  res.status(201).json(await cadastroFamiliaService.cadastrar(req.body));
});
// Lista de orientadores para o formulário de cadastro (só id e nome).
authRoutes.get('/orientadores', async (_req, res) => {
  res.json(await cadastroFamiliaService.listarOrientadores());
});
