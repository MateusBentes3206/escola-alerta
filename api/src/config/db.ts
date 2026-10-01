import { Pool } from 'pg';
import { env } from './env';

// Um único pool de conexões para toda a aplicação.
// Só os Repositories devem importar isto (padrão Repository, Eixo 2 §1.2.2).
export const pool = new Pool({ connectionString: env.databaseUrl });
