/**
 * Erro "esperado" da aplicação, com status HTTP.
 * Services lançam AppError; o middleware de erros converte em resposta JSON.
 * Qualquer outro erro vira 500 sem vazar detalhes internos.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
