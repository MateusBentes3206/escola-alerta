import { pool } from '../src/config/db';
import { rodarSeed, SENHA_PADRAO_SEED, USUARIOS_SEED } from '../src/database/seed';

(async () => {
  try {
    await rodarSeed(pool);
    console.log('Seed aplicado. Usuários de demonstração (senha: %s):', SENHA_PADRAO_SEED);
    for (const u of USUARIOS_SEED) console.log(`  ${u.perfil.padEnd(12)} ${u.email}`);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
