import { app } from './app';
import { pool } from './config/db';
import { env } from './config/env';
import { reavaliacaoPeriodica } from './container';
import { rodarMigrations } from './database/migrator';
import { rodarSeed } from './database/seed';

const SEIS_HORAS = 6 * 60 * 60 * 1000;

async function iniciar() {
  // Em produção (Render), AUTO_SETUP=true aplica as migrations e os dados fictícios de demonstração.
  // O seed é idempotente: não duplica nada se o servidor reiniciar.
  if (process.env.AUTO_SETUP === 'true') {
    console.log('AUTO_SETUP: aplicando migrations e seed...');
    await rodarMigrations(pool);
    await rodarSeed(pool);
    console.log('AUTO_SETUP: banco pronto.');
  }

  app.listen(env.port, () => {
    console.log(`EscolaAlerta API rodando em http://localhost:${env.port}`);
    reavaliacaoPeriodica.iniciar(SEIS_HORAS);
  });
}

iniciar().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
