import { Pool } from 'pg';
import { CausaRaiz } from '../domain/risco';

export type Matriz = Record<CausaRaiz, string[]>;

export interface IMatrizRepository {
  /** Matriz personalizada do orientador, ou null se ele usa a padrão. */
  obter(orientadorId: string): Promise<{ matriz: Matriz; atualizadoEm: string } | null>;
  /** Substitui a matriz inteira numa transação. */
  salvar(orientadorId: string, matriz: Matriz): Promise<void>;
  /** Volta para a matriz padrão. */
  limpar(orientadorId: string): Promise<void>;
}

export class PgMatrizRepository implements IMatrizRepository {
  constructor(private readonly pool: Pool) {}

  async obter(orientadorId: string) {
    const { rows } = await this.pool.query<{ causa: CausaRaiz; texto: string; atualizado_em: Date }>(
      'SELECT causa, texto, atualizado_em FROM matriz_sugestoes WHERE orientador_id = $1 ORDER BY causa, ordem',
      [orientadorId],
    );
    if (rows.length === 0) return null;
    const matriz: Matriz = { NOTAS: [], FALTAS: [], OCORRENCIAS: [], SAIDAS: [] };
    for (const r of rows) matriz[r.causa].push(r.texto);
    const atualizadoEm = new Date(Math.max(...rows.map((r) => r.atualizado_em.getTime()))).toISOString();
    return { matriz, atualizadoEm };
  }

  async salvar(orientadorId: string, matriz: Matriz) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM matriz_sugestoes WHERE orientador_id = $1', [orientadorId]);
      for (const [causa, textos] of Object.entries(matriz)) {
        for (const [i, texto] of textos.entries()) {
          await client.query(
            'INSERT INTO matriz_sugestoes (orientador_id, causa, texto, ordem) VALUES ($1, $2, $3, $4)',
            [orientadorId, causa, texto, i + 1],
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async limpar(orientadorId: string) {
    await this.pool.query('DELETE FROM matriz_sugestoes WHERE orientador_id = $1', [orientadorId]);
  }
}
