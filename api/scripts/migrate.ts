import { pool } from '../src/config/db';
import { rodarMigrations } from '../src/database/migrator';

// npm run db:migrate          -> aplica só as migrations novas
// npm run db:migrate -- --reset -> apaga tudo e recria (CUIDADO: perde os dados)
(async () => {
  const reset = process.argv.includes('--reset');
  console.log(reset ? 'Recriando o banco do zero...' : 'Aplicando migrations...');
  try {
    await rodarMigrations(pool, { reset });
    console.log('Banco atualizado.');
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
