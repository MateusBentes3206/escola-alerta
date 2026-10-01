import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const PASTA = path.resolve(__dirname, '../../migrations');

/**
 * Aplica, em ordem, os arquivos .sql de /migrations que ainda não rodaram.
 * Cada migration roda dentro de uma transação: se falhar, nada fica pela metade.
 * Com reset=true, apaga o schema inteiro antes (uso em dev e nos testes).
 */
export async function rodarMigrations(pool: Pool, { reset = false, log = true } = {}) {
  if (reset) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome TEXT PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query<{ nome: string }>('SELECT nome FROM schema_migrations');
  const jaAplicadas = new Set(rows.map((r) => r.nome));

  const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();

  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue;
    const sql = fs.readFileSync(path.join(PASTA, arquivo), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
      await client.query('COMMIT');
      if (log) console.log(`  ✔ ${arquivo}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falha na migration ${arquivo}: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}
