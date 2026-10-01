import { Router } from 'express';
import { pool } from '../config/db';
import { AuthController } from '../controllers/AuthController';
import { autenticar } from '../middlewares/auth';
import { PgUsuarioRepository } from '../repositories/UsuarioRepository';
import { AuthService } from '../services/AuthService';

// Montagem das camadas: Repository -> Service -> Controller
const authController = new AuthController(new AuthService(new PgUsuarioRepository(pool)));

export const authRoutes = Router();
authRoutes.post('/login', authController.login);
authRoutes.get('/me', autenticar, authController.me);
