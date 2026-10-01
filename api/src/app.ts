import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros';
import { routes } from './routes';

export const app = express();

// CORS: só as origens listadas em FRONT_URL podem chamar a API pelo navegador.
app.use(cors({ origin: env.frontUrls.length ? env.frontUrls : false }));
app.use(express.json({ limit: '100kb' }));

app.use(routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros); // sempre o último
