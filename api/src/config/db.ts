import { Pool, types } from 'pg';
import { env } from './env';

// DATE volta como texto 'AAAA-MM-DD' (sem conversão de fuso) e NUMERIC como número.
types.setTypeParser(1082, (valor) => valor);
types.setTypeParser(1700, (valor) => parseFloat(valor));

// Um único pool de conexões para toda a aplicação.
// Só os Repositories devem importar isto (padrão Repository, Eixo 2 §1.2.2).
export const pool = new Pool({ connectionString: env.databaseUrl });
