import { Router } from 'express';
import { authService } from '../container';
import { AuthController } from '../controllers/AuthController';
import { autenticar } from '../middlewares/auth';

// Montagem das camadas (Repository -> Service) fica em container.ts
const authController = new AuthController(authService);

export const authRoutes = Router();
authRoutes.post('/login', authController.login);
authRoutes.get('/me', autenticar, authController.me);
