import { Pool } from 'pg';
import { Perfil, Usuario } from '../domain/usuario';

/**
 * Contrato que os Services conhecem. Nos testes unitários dá para passar
 * um objeto falso que implementa esta interface, sem banco (Eixo 2 §1.2.2).
 */
export interface IUsuarioRepository {
  buscarPorEmail(email: string): Promise<Usuario | null>;
  buscarPorId(id: string): Promise<Usuario | null>;
  criar(dados: { nome: string; email: string; senhaHash: string; perfil: Perfil }): Promise<Usuario>;
  listarPorPerfil(perfil: Perfil): Promise<Usuario[]>;
  atualizarTelefone(id: string, telefone: string | null): Promise<void>;
}

// Linha do banco (snake_case) -> objeto de domínio (camelCase)
interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: Perfil;
  telefone: string | null;
}

function mapear(row: UsuarioRow): Usuario {
  return { id: row.id, nome: row.nome, email: row.email, senhaHash: row.senha_hash, perfil: row.perfil, telefone: row.telefone };
}

export class PgUsuarioRepository implements IUsuarioRepository {
  constructor(private readonly pool: Pool) {}

  async buscarPorEmail(email: string) {
    // Sempre query parametrizada ($1): nunca concatenar string em SQL (evita SQL injection).
    const { rows } = await this.pool.query<UsuarioRow>(
      'SELECT id, nome, email, senha_hash, perfil, telefone FROM usuarios WHERE lower(email) = lower($1)',
      [email],
    );
    return rows[0] ? mapear(rows[0]) : null;
  }

  async buscarPorId(id: string) {
    const { rows } = await this.pool.query<UsuarioRow>(
      'SELECT id, nome, email, senha_hash, perfil, telefone FROM usuarios WHERE id = $1',
      [id],
    );
    return rows[0] ? mapear(rows[0]) : null;
  }

  async criar(dados: { nome: string; email: string; senhaHash: string; perfil: Perfil }) {
    const { rows } = await this.pool.query<UsuarioRow>(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, senha_hash, perfil, telefone`,
      [dados.nome, dados.email, dados.senhaHash, dados.perfil],
    );
    return mapear(rows[0]);
  }

  async listarPorPerfil(perfil: Perfil) {
    const { rows } = await this.pool.query<UsuarioRow>(
      'SELECT id, nome, email, senha_hash, perfil, telefone FROM usuarios WHERE perfil = $1 ORDER BY nome',
      [perfil],
    );
    return rows.map(mapear);
  }

  async atualizarTelefone(id: string, telefone: string | null) {
    await this.pool.query('UPDATE usuarios SET telefone = $2 WHERE id = $1', [id, telefone]);
  }
}
