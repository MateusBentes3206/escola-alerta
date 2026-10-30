import { Pool } from 'pg';

export interface NovaFamilia {
  nome: string;
  email: string;
  senhaHash: string;
  telefone: string;
  filhos: { nome: string; turma: string; orientadorId: string }[];
}

export interface ICadastroFamiliaRepository {
  emailEmUso(email: string): Promise<boolean>;
  orientadores(): Promise<{ id: string; nome: string }[]>;
  /** Cria o responsável e os filhos numa transação só: ou entra tudo, ou nada. */
  criar(f: NovaFamilia): Promise<{ responsavelId: string; alunoIds: string[] }>;
}

export class PgCadastroFamiliaRepository implements ICadastroFamiliaRepository {
  constructor(private readonly pool: Pool) {}

  async emailEmUso(email: string) {
    const { rowCount } = await this.pool.query('SELECT 1 FROM usuarios WHERE lower(email) = lower($1)', [email]);
    return (rowCount ?? 0) > 0;
  }

  async orientadores() {
    const { rows } = await this.pool.query<{ id: string; nome: string }>(
      "SELECT id, nome FROM usuarios WHERE perfil = 'ORIENTADOR' ORDER BY nome",
    );
    return rows;
  }

  async criar(f: NovaFamilia) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO usuarios (nome, email, senha_hash, perfil, telefone) VALUES ($1, $2, $3, 'RESPONSAVEL', $4) RETURNING id`,
        [f.nome, f.email, f.senhaHash, f.telefone],
      );
      const alunoIds: string[] = [];
      for (const filho of f.filhos) {
        const r = await client.query<{ id: string }>(
          `INSERT INTO alunos (nome, turma, orientador_id, responsavel_id, vinculo_confirmado)
           VALUES ($1, $2, $3, $4, false) RETURNING id`,
          [filho.nome, filho.turma, filho.orientadorId, rows[0].id],
        );
        alunoIds.push(r.rows[0].id);
      }
      await client.query('COMMIT');
      return { responsavelId: rows[0].id, alunoIds };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
