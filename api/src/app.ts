import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros';
import { routes } from './routes';

export const app = express();

// CORS: só as origens listadas em FRONT_URL podem chamar a API pelo navegador.
app.use(cors({ origin: env.frontUrls.length ? env.frontUrls : false }));
app.use(express.json({ limit: '100kb' }));

// Front-end servido pela própria API (deploy em um único serviço: mesma origem, sem CORS).
// Em dev o front continua podendo rodar separado na porta 5500.
const PASTA_FRONT = path.resolve(__dirname, '../../front');
if (fs.existsSync(path.join(PASTA_FRONT, 'index.html'))) {
  app.use(express.static(PASTA_FRONT));
}

app.use(routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros); // sempre o último
