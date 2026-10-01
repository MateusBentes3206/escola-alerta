import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

/**
 * Ponto único de tratamento de erros. Formato padrão de resposta de erro:
 *   { "erro": "mensagem para o usuário", "detalhes": ... (opcional) }
 * O front só precisa ler "erro" para mostrar no toast.
 */
export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: err.issues[0]?.message ?? 'Dados inválidos.',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.detalhes });
  }

  // JSON malformado no body
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }

  if (!env.isTest) console.error(err);
  return res.status(500).json({ erro: 'Erro interno. Tente novamente em instantes.' });
}

export function rotaNaoEncontrada(req: Request, res: Response) {
  res.status(404).json({ erro: `Rota ${req.method} ${req.path} não encontrada.` });
}
