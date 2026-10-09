import { app } from './app';
import { env } from './config/env';
import { reavaliacaoPeriodica } from './container';

const SEIS_HORAS = 6 * 60 * 60 * 1000;

app.listen(env.port, () => {
  console.log(`EscolaAlerta API rodando em http://localhost:${env.port}`);
  reavaliacaoPeriodica.iniciar(SEIS_HORAS);
});
